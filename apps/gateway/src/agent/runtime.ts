import type { Task, TaskPriority } from "@myown/database";
import OpenAI from "openai";
import { config, isLlmEnabled } from "../config.js";
import type { TaskService } from "../services/task.js";
import { formatDate, formatDateTime } from "../utils/date.js";
import { displayOrderOf, formatActiveTasksHint } from "../utils/task-display-order.js";
import {
  fireAtFromMinutes,
  isDateOnlyDue,
  parseAddCommand,
  parseFlexibleRemindRequest,
  parseRemindDateTime,
  parseRemindPhrase,
} from "../utils/datetime-parse.js";
import {
  type CompleteTaskArgs,
  type CreateReminderArgs,
  type CreateTaskArgs,
  agentTools,
  resolveDueAt,
} from "./tools.js";
import {
  type ComposeMemoArgs,
  composeMemoTool,
} from "./compose-memo.js";

function formatDueLabel(dueAt: Date): string {
  return isDateOnlyDue(dueAt) ? formatDate(dueAt) : formatDateTime(dueAt);
}

export interface ComposeMemoContext {
  title: string;
  description?: string | null;
  dueAt?: Date | null;
  priority: TaskPriority;
}

export class AgentRuntime {
  private readonly openai: OpenAI | null;

  constructor(private readonly taskService: TaskService) {
    if (config.llmBaseUrl) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey || "ollama",
        baseURL: config.llmBaseUrl,
      });
    } else if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    } else {
      this.openai = null;
    }
  }

  async handleMessage(input: {
    userId: string;
    telegramUserId: number;
    text: string;
    activeTasks: Task[];
  }): Promise<string> {
    const commandReply = await this.tryCommand(input);
    if (commandReply) return commandReply;

    if (!isLlmEnabled() || !this.openai) {
      return [
        "자연어 처리를 위해 LLM 설정이 필요합니다.",
        "(LLM_BASE_URL 원격 Ollama 또는 OPENAI_API_KEY)",
        "지금은 명령어를 사용해 주세요:",
        "/list — 업무 목록",
        "/today — 오늘 마감",
        "/add <제목> [YYYY-MM-DD] [HH:MM]",
        "/remind <번호> [YYYY-MM-DD] HH:MM",
        "/remind <번호> 5분",
        '/done <번호> — 완료',
      ].join("\n");
    }

    try {
      return await this.runAgent(input);
    } catch (err) {
      console.error("[llm] agent error:", err);
      const hint =
        err instanceof Error && err.message.includes("timed out")
          ? "LLM 응답 시간 초과입니다. 더 작은 모델을 쓰거나 /add 명령어를 사용해 주세요."
          : "LLM 처리 오류입니다. 모델명·터널·Ollama 상태를 확인하거나 /list 등 명령어를 사용해 주세요.";
      return `⚠️ ${hint}`;
    }
  }

  private async llmCall(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  ) {
    const timeout = config.llmTimeoutMs;
    return Promise.race([
      this.openai!.chat.completions.create(params),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("LLM request timed out")), timeout),
      ),
    ]);
  }

  /** 첨부 업무 compose 답장 메모 → 제목·설명·마감·우선순위 추출 */
  async parseComposeMemo(
    context: {
      title: string;
      description?: string | null;
      dueAt?: Date | null;
      priority: TaskPriority;
    },
    memo: string,
  ): Promise<
    | {
        ok: true;
        patch: {
          title: string;
          description?: string | null;
          priority?: TaskPriority;
          dueAt?: Date | null;
        };
      }
    | { ok: false; message: string }
  > {
    if (!isLlmEnabled() || !this.openai) {
      return { ok: false, message: "llm_disabled" };
    }

    const currentDue = context.dueAt ? formatDueLabel(context.dueAt) : "없음";

    try {
      const response = await this.llmCall({
        model: config.llmModel,
        messages: [
          {
            role: "system",
            content: [
              "사용자가 첨부 파일과 함께 등록 중인 업무에 메모를 남겼습니다.",
              "메모에서 제목, 설명, 마감일·시각, 우선순위를 추출해 fill_task_from_memo를 한 번 호출하세요.",
              `타임존: ${config.timezone}`,
              `오늘: ${formatDate(new Date())}`,
              `현재 제목: ${context.title}`,
              `현재 설명: ${context.description ?? "(없음)"}`,
              `현재 마감: ${currentDue}`,
              `현재 우선순위: ${context.priority}`,
              "마감·우선순위가 메모에 없으면 해당 필드는 생략하세요.",
              "제목은 메모 의도에 맞게 간결하게 정리하세요.",
            ].join("\n"),
          },
          { role: "user", content: memo },
        ],
        tools: [composeMemoTool],
        tool_choice: { type: "function", function: { name: "fill_task_from_memo" } },
      });

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.type !== "function") {
        return { ok: false, message: "메모를 이해하지 못했습니다." };
      }

      const args = JSON.parse(toolCall.function.arguments || "{}") as ComposeMemoArgs;
      const title = args.title?.trim();
      if (!title) {
        return { ok: false, message: "제목을 추출하지 못했습니다." };
      }

      const patch: {
        title: string;
        description?: string | null;
        priority?: TaskPriority;
        dueAt?: Date | null;
      } = { title };

      if (args.description !== undefined) {
        patch.description = args.description.trim() || null;
      }
      if (args.priority) {
        patch.priority = args.priority;
      }
      if (args.due_date?.trim()) {
        patch.dueAt = resolveDueAt(args.due_date, args.due_time) ?? null;
      }

      return { ok: true, patch };
    } catch (err) {
      console.error("[llm] compose memo error:", err);
      const message =
        err instanceof Error && err.message.includes("timed out")
          ? "메모 분석 시간이 초과되었습니다."
          : "메모 분석 중 오류가 발생했습니다.";
      return { ok: false, message };
    }
  }

  private async tryCommand(input: {
    userId: string;
    telegramUserId: number;
    text: string;
    activeTasks: Task[];
  }): Promise<string | null> {
    const text = input.text.trim();

    const doneMatch = text.match(/^(?:\/done|완료)\s*(\d+)$/i);
    if (doneMatch) {
      const result = await this.taskService.completeByIndex(
        input.userId,
        Number(doneMatch[1]),
      );
      return result.ok
        ? `✅ ${result.task.title} 완료 처리했습니다.`
        : result.message;
    }

    const naturalDone = text.match(/^(\d+)\s*번?\s*완료/i);
    if (naturalDone) {
      const result = await this.taskService.completeByIndex(
        input.userId,
        Number(naturalDone[1]),
      );
      return result.ok
        ? `✅ ${result.task.title} 완료 처리했습니다.`
        : result.message;
    }

    if (text.startsWith("/add ")) {
      const parsed = parseAddCommand(text.slice(5).trim());
      const task = await this.taskService.create({
        userId: input.userId,
        telegramUserId: input.telegramUserId,
        title: parsed.title,
        dueAt: parsed.dueAt,
      });
      const due = task.dueAt ? ` (마감: ${formatDueLabel(task.dueAt)})` : "";
      return `✅ 업무 등록: ${task.title}${due}`;
    }

    const remindMinutesCmd = text.match(/^\/remind\s+(\d+)\s+(\d+)\s*분$/);
    if (remindMinutesCmd) {
      return this.replyScheduledReminder(
        input,
        Number(remindMinutesCmd[1]),
        fireAtFromMinutes(Number(remindMinutesCmd[2])),
      );
    }

    const remindCmd = text.match(
      /^\/remind\s+(\d+)\s+(?:(\d{4}-\d{2}-\d{2})\s+)?(\d{1,2}:\d{2})$/i,
    );
    if (remindCmd) {
      const fireAt = parseRemindDateTime(remindCmd[2], remindCmd[3]);
      if (!fireAt) {
        return "⚠️ 날짜·시간 형식을 확인해 주세요. 예: /remind 1 2026-06-15 14:00";
      }
      return this.replyScheduledReminder(input, Number(remindCmd[1]), fireAt);
    }

    const remindMinutesNatural = text.match(
      /^(\d+)\s*번?\s*(\d+)\s*분\s*(?:후|뒤|뒤에)?/,
    );
    if (remindMinutesNatural) {
      return this.replyScheduledReminder(
        input,
        Number(remindMinutesNatural[1]),
        fireAtFromMinutes(Number(remindMinutesNatural[2])),
      );
    }

    const remindNatural = text.match(/^(\d+)\s*번?\s*(.+알려.*)$/i);
    if (remindNatural) {
      const fireAt = parseRemindPhrase(remindNatural[2]);
      if (!fireAt) {
        return '⚠️ 시각을 이해하지 못했습니다. 예: "1번 5분 후에 알려줘", "1번 내일 15시에 알려줘"';
      }
      return this.replyScheduledReminder(input, Number(remindNatural[1]), fireAt);
    }

    const flexRemind = parseFlexibleRemindRequest(text);
    if (flexRemind) {
      let task =
        flexRemind.listIndex !== undefined
          ? await this.taskService.resolveActiveTask(input.userId, flexRemind.listIndex)
          : await this.taskService.resolveActiveTaskByHint(input.userId, text);

      if (!task && input.activeTasks.length === 1) {
        task = input.activeTasks[0];
      }

      if (!task) {
        const hint = formatActiveTasksHint(input.activeTasks);
        return `⚠️ 어떤 업무에 알림을 걸지 확인하지 못했습니다.\n예: "3번 10분 후에 알려줘"\n${hint}`;
      }

      return this.replyScheduledReminderForTask(input, task, fireAtFromMinutes(flexRemind.minutes));
    }

    return null;
  }

  private async replyScheduledReminderForTask(
    input: { userId: string; telegramUserId: number; activeTasks?: Task[] },
    task: Task,
    fireAt: Date,
  ): Promise<string> {
    const result = await this.taskService.scheduleReminderForTask(
      input.userId,
      input.telegramUserId,
      task,
      fireAt,
    );
    if (!result.ok) return result.message;

    const active = input.activeTasks ?? (await this.taskService.getActiveTasks(input.userId));
    const order = displayOrderOf(active, task.id);
    const msUntil = result.fireAt.getTime() - Date.now();
    const when =
      msUntil < 60 * 60 * 1000
        ? `${Math.max(1, Math.round(msUntil / 60_000))}분 후`
        : formatDateTime(result.fireAt);

    const label = order ? `${order}번 ` : "";
    return `⏰ ${label}"${result.task.title}", ${when}에 알려드릴게요.`;
  }

  private async replyScheduledReminder(
    input: { userId: string; telegramUserId: number },
    displayOrder: number,
    fireAt: Date,
  ): Promise<string> {
    const result = await this.taskService.scheduleReminder(
      input.userId,
      input.telegramUserId,
      displayOrder,
      fireAt,
    );
    if (!result.ok) return result.message;

    const active = await this.taskService.getActiveTasks(input.userId);
    const order = displayOrderOf(active, result.task.id) ?? displayOrder;
    const msUntil = result.fireAt.getTime() - Date.now();
    const when =
      msUntil < 60 * 60 * 1000
        ? `${Math.max(1, Math.round(msUntil / 60_000))}분 후`
        : formatDateTime(result.fireAt);

    return `⏰ ${order}번 "${result.task.title}", ${when}에 알려드릴게요.`;
  }

  private async runAgent(input: {
    userId: string;
    telegramUserId: number;
    text: string;
    activeTasks: Task[];
  }): Promise<string> {
    const taskContext = input.activeTasks
      .map((t, i) =>
        `${i + 1}. ${t.title}${t.dueAt ? ` (마감 ${formatDueLabel(t.dueAt)})` : ""}`,
      )
      .join("\n");

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: [
          "당신은 개인 업무 비서입니다. 한국어로 답변하세요.",
          `타임존: ${config.timezone}`,
          `오늘: ${formatDate(new Date())}`,
          "활성 업무:",
          taskContext || "(없음)",
          "업무 등록 시 due_date(YYYY-MM-DD), due_time(HH:MM)을 사용하세요.",
          "특정 시각 알림은 create_reminder 도구를 사용하세요.",
          "create_reminder·complete_task의 list_index는 위 목록의 1, 2, 3… 순번입니다. 완료된 업무 번호는 사용하지 마세요.",
          "인사·잡담에는 도구를 호출하지 말고 짧게 답하세요.",
          "마크다운 문법(** · * · # · ` 등)을 쓰지 말고, 줄바꿈만 쓰는 평문으로 답하세요.",
        ].join("\n"),
      },
      { role: "user", content: input.text },
    ];

    for (let step = 0; step < 5; step++) {
      const response = await this.llmCall({
        model: config.llmModel,
        messages,
        tools: agentTools,
        tool_choice: "auto",
      });

      const choice = response.choices[0]?.message;
      if (!choice) return "응답을 생성하지 못했습니다.";

      if (!choice.tool_calls?.length) {
        return choice.content ?? "처리했습니다.";
      }

      messages.push(choice);

      for (const toolCall of choice.tool_calls) {
        if (toolCall.type !== "function") continue;
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const result = await this.executeTool(
          toolCall.function.name,
          args,
          input.userId,
          input.telegramUserId,
        );
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }

    return "요청 처리 중 단계 제한에 도달했습니다. 다시 시도해 주세요.";
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    userId: string,
    telegramUserId: number,
  ): Promise<string> {
    switch (name) {
      case "create_task": {
        const a = args as unknown as CreateTaskArgs;
        const dueAt = resolveDueAt(a.due_date, a.due_time);
        const task = await this.taskService.create({
          userId,
          telegramUserId,
          title: a.title,
          description: a.description,
          priority: a.priority,
          dueAt,
        });
        const due = task.dueAt ? `, 마감 ${formatDueLabel(task.dueAt)}` : "";
        return `등록됨: ${task.title}${due}`;
      }
      case "create_reminder": {
        const a = args as unknown as CreateReminderArgs;
        const fireAt = a.remind_in_minutes
          ? fireAtFromMinutes(a.remind_in_minutes)
          : a.remind_time
            ? parseRemindDateTime(a.remind_date, a.remind_time)
            : undefined;
        if (!fireAt) {
          return "remind_time(HH:MM) 또는 remind_in_minutes(분) 중 하나가 필요합니다.";
        }
        if (!a.list_index) {
          return "list_index가 필요합니다. /list 의 활성 번호를 사용하세요.";
        }
        const result = await this.taskService.scheduleReminder(
          userId,
          telegramUserId,
          a.list_index,
          fireAt,
        );
        return result.ok
          ? `알림 예약: ${formatDateTime(result.fireAt)}`
          : result.message;
      }
      case "complete_task": {
        const a = args as CompleteTaskArgs;
        const result = a.list_index
          ? await this.taskService.completeByIndex(userId, a.list_index)
          : a.title
            ? await this.taskService.completeByTitle(userId, a.title)
            : { ok: false as const, message: "list_index 또는 title이 필요합니다." };
        return result.ok ? `완료: ${result.task.title}` : result.message;
      }
      case "list_tasks":
        return await this.taskService.listActive(userId);
      case "list_today_tasks":
        return await this.taskService.listToday(userId);
      default:
        return `알 수 없는 도구: ${name}`;
    }
  }
}
