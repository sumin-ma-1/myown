import type { ReminderRepository, Task, TaskPriority, UserRepository } from "@myown/database";
import OpenAI from "openai";
import { config, isLlmEnabled } from "../config.js";
import type { TaskService } from "../services/task.js";
import type { ReminderService } from "../services/reminder.js";
import type { PendingComposeReminderStore } from "../services/pending-compose-reminder-store.js";
import {
  applyDraftReminderConfig,
  formatReminderConfigLabel,
  parseDraftReminderConfig,
} from "../services/draft-reminder.js";
import { formatDateTime, formatDueDate, formatDueDateTime, llmDueDateContextLines } from "../utils/date.js";
import { displayOrderOf, formatActiveTasksHint } from "../utils/task-display-order.js";
import {
  fireAtFromMinutes,
  isDateOnlyDue,
  parseAddCommand,
  parseFlexibleRemindRequest,
  parseRemindDateTime,
  parseRemindPhrase,
  parseKoreanDueSupplement,
  looksLikeDueSupplementOnly,
  todayDateString,
} from "../utils/datetime-parse.js";
import {
  type CancelReminderArgs,
  type CompleteTaskArgs,
  type CreateReminderArgs,
  type CreateTaskArgs,
  type ListRemindersArgs,
  type SetTaskRemindersArgs,
  agentTools,
  resolveDueAt,
} from "./tools.js";
import {
  type ComposeMemoArgs,
  composeMemoTool,
} from "./compose-memo.js";
import {
  sanitizeComposeMemoPatch,
} from "../telegram/helpers/compose-memo-infer.js";
import type { ChatTurn } from "../services/chat-memory-store.js";
import { parseTextToolCalls } from "./text-tool-call.js";
import { decodeLlmStringFields, decodeLlmUtf8Escapes } from "../utils/llm-text-decode.js";

function formatDueLabel(dueAt: Date): string {
  return isDateOnlyDue(dueAt) ? formatDueDate(dueAt) : formatDueDateTime(dueAt);
}

export interface ComposeMemoContext {
  title: string;
  description?: string | null;
  dueAt?: Date | null;
  priority: TaskPriority;
}

export interface AgentMessageInput {
  userId: string;
  telegramUserId: number;
  text: string;
  activeTasks: Task[];
  recentTurns?: ChatTurn[];
  timezone: string;
}

export interface AgentRuntimeDeps {
  taskService: TaskService;
  users: UserRepository;
  reminders: ReminderRepository;
  reminderService: ReminderService;
  pendingComposeReminder: PendingComposeReminderStore;
}

export class AgentRuntime {
  private readonly openai: OpenAI | null;
  private readonly taskService: TaskService;
  private readonly users: UserRepository;
  private readonly reminders: ReminderRepository;
  private readonly reminderService: ReminderService;
  private readonly pendingComposeReminder: PendingComposeReminderStore;

  constructor(deps: AgentRuntimeDeps) {
    this.taskService = deps.taskService;
    this.users = deps.users;
    this.reminders = deps.reminders;
    this.reminderService = deps.reminderService;
    this.pendingComposeReminder = deps.pendingComposeReminder;
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

  async handleMessage(input: AgentMessageInput): Promise<string> {
    const commandReply = await this.tryCommand(input);
    if (commandReply) return commandReply;

    if (!isLlmEnabled() || !this.openai) {
      return [
        "자연어 처리를 위해 LLM 설정이 필요합니다.",
        "(LLM_BASE_URL 원격 Ollama 또는 OPENAI_API_KEY)",
        "지금은 명령어를 사용해 주세요:",
        "/list: 업무 목록",
        "/today: 오늘 마감",
        "/add <제목> [YYYY-MM-DD] [HH:MM]",
        "/remind <번호> [YYYY-MM-DD] HH:MM",
        "/remind <번호> 5분",
        '/done <번호>: 완료',
      ].join("\n");
    }

    try {
      return decodeLlmUtf8Escapes(await this.runAgent(input));
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
    timezone: string,
  ): Promise<
    | {
        ok: true;
        patch: {
          title: string;
          description?: string | null;
          priority?: TaskPriority;
          dueAt?: Date | null;
          reminderConfig?: import("../services/draft-reminder.js").DraftReminderConfig;
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
              "사용자가 첨부 파일 업무 등록 중에 후속 메모를 보냈습니다.",
              "메모 의도를 파악해 fill_task_from_memo로 변경할 필드만 채우세요.",
              ...llmDueDateContextLines(timezone),
              `현재 제목: ${context.title}`,
              `현재 설명: ${context.description ?? "(없음)"}`,
              `현재 마감: ${currentDue}`,
              `현재 우선순위: ${context.priority}`,
              "",
              "규칙:",
              "- 마감·시각 보충이면 due_date/due_time만, title 생략 (예: '오후 6시에', '내일까지')",
              "- 우선순위 보충이면 priority만 (예: '급해요', '최우선으로')",
              "- 설명·메모 추가면 description만 (예: '팀장님 검토 필요')",
              "- 제목 변경은 사용자가 분명히 바꾸려 할 때만 title (예: '분기 보고서로 할게', '제목은 회의록')",
              "- 알림 의도(없음/하나만/언제만)가 있으면 reminder_config만 채우세요",
              "- 메모 전체를 title로 복사하지 마세요",
              "- 언급되지 않은 필드는 생략",
            ].join("\n"),
          },
          { role: "user", content: memo },
        ],
        tools: [composeMemoTool],
        tool_choice: { type: "function", function: { name: "fill_task_from_memo" } },
      });

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      let args: ComposeMemoArgs;
      if (toolCall && toolCall.type === "function") {
        args = decodeLlmStringFields(
          JSON.parse(toolCall.function.arguments || "{}") as ComposeMemoArgs,
        );
      } else {
        const content = response.choices[0]?.message?.content;
        const textCalls = parseTextToolCalls(content);
        const memoCall = textCalls.find((c) => c.name === "fill_task_from_memo");
        if (!memoCall) {
          return { ok: false, message: "메모를 이해하지 못했습니다." };
        }
        args = decodeLlmStringFields(memoCall.args as ComposeMemoArgs);
      }
      let patch: {
        title: string;
        description?: string | null;
        priority?: TaskPriority;
        dueAt?: Date | null;
        reminderConfig?: import("../services/draft-reminder.js").DraftReminderConfig;
      } = {
        title: args.title?.trim() || context.title,
      };

      if (args.description !== undefined) {
        patch.description = args.description.trim() || null;
      }
      if (args.priority) {
        patch.priority = args.priority;
      }
      if (args.due_date?.trim()) {
        patch.dueAt = resolveDueAt(args.due_date, args.due_time) ?? null;
      } else if (args.due_time?.trim()) {
        const dateStr = context.dueAt
          ? todayDateString(context.dueAt)
          : todayDateString();
        patch.dueAt = resolveDueAt(dateStr, args.due_time) ?? null;
      } else if (looksLikeDueSupplementOnly(memo)) {
        patch.dueAt = parseKoreanDueSupplement(memo, context.dueAt) ?? null;
      }

      const reminderConfig = parseDraftReminderConfig(
        args as unknown as Record<string, unknown>,
      );
      if (reminderConfig) {
        patch.reminderConfig = reminderConfig;
      }

      patch = sanitizeComposeMemoPatch(memo, context, patch);

      if (!patch.title) {
        return { ok: false, message: "제목을 추출하지 못했습니다." };
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

  private async runAgent(input: AgentMessageInput): Promise<string> {
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
          ...llmDueDateContextLines(input.timezone),
          "활성 업무:",
          taskContext || "(없음)",
          "업무 등록 시 due_date(YYYY-MM-DD), due_time(HH:MM)을 사용하세요.",
          "날짜는 있는데 시각이 없고, 시각이 필요한 일정이라고 판단되면 create_task를 바로 호출하지 말고 한 번만 '몇 시인가요?'라고 물으세요.",
          "사용자가 시각을 알려주면 반드시 create_task를 due_time과 함께 호출하세요. 말로만 '등록했습니다'라고 하지 마세요.",
          "사용자가 시각 없이 진행하겠다고 하면 반드시 create_task를 due_time 없이 호출하세요.",
          "제출·마감·할 일처럼 날짜만으로 충분한 업무이거나, 처음부터 종일·시각 불필요를 말했으면 묻지 말고 due_time 없이 create_task하세요.",
          "특정 시각 알림 추가는 create_reminder, 조회는 list_reminders, 취소는 cancel_reminder, 한 번에 다시 맞추려면 set_task_reminders를 사용하세요.",
          "create_reminder·list_reminders·cancel_reminder·set_task_reminders·complete_task의 list_index는 위 목록의 1, 2, 3… 순번입니다. 완료된 업무 번호는 사용하지 마세요.",
          "인사·잡담에는 도구를 호출하지 말고 짧게 답하세요.",
          "최근 대화는 현재 메시지와 관련이 있을 때만 참고하세요. 직전 대화에서 시각을 물었거나 추가 정보를 요청했다면, 후속 답변을 맥락과 함께 해석하고 정보가 충분하면 create_task를 호출하세요.",
          "create_task는 초안만 만듭니다. 도구를 호출하지 않은 채 '등록 완료/등록했습니다/일정이 등록되어 있어요'라고 말하지 마세요.",
          "등록 문장에 알림 의도가 있으면 create_task의 reminder_config를 채우세요. 예: 알림 없음→use_default_reminders=false, 하나만(마감 당일)→use_default_reminders=false+extra_rules[{days_before:0}], 언제만→use_default_reminders=false+absolute_times. 없으면 reminder_config 생략(기본 D-DAY). 전역 알림 설정은 바꾸지 마세요. 애매하면 한 번만 묻세요.",
          "이미 등록된 업무 알림을 '다 끄고 ○○만'처럼 바꾸면 set_task_reminders를 쓰세요.",
          "일정·목록·등록 여부·오늘 뭐 있는지 물으면 반드시 list_tasks 또는 list_today_tasks를 호출하고, 도구 결과만 말하세요. 추측으로 등록됐다고 답하지 마세요.",
          "최근 대화·초안·미등록 내용은 실제 일정이 아닙니다. [등록 완료] 전 초안도 일정이 아닙니다.",
          "마크다운 문법(** · * · # · ` 등)을 쓰지 말고, 줄바꿈만 쓰는 평문으로 답하세요.",
        ].join("\n"),
      },
    ];

    for (const turn of input.recentTurns ?? []) {
      if (turn.role !== "user" && turn.role !== "assistant") continue;
      const text = turn.text.trim();
      if (!text) continue;
      messages.push({ role: turn.role, content: text });
    }

    messages.push({ role: "user", content: input.text });

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
        const textTools = parseTextToolCalls(
          choice.content ? decodeLlmUtf8Escapes(choice.content) : choice.content,
        );
        if (textTools.length > 0) {
          const results: string[] = [];
          for (const call of textTools) {
            const result = await this.executeTool(
              call.name,
              decodeLlmStringFields(call.args),
              input.userId,
              input.telegramUserId,
            );
            results.push(result);
          }
          return results.join("\n");
        }
        return choice.content
          ? decodeLlmUtf8Escapes(choice.content)
          : "처리했습니다.";
      }

      messages.push(choice);

      let createdDraftResult: string | undefined;
      for (const toolCall of choice.tool_calls) {
        if (toolCall.type !== "function") continue;
        const args = decodeLlmStringFields(
          JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>,
        );
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
        if (toolCall.function.name === "create_task") {
          createdDraftResult = result;
        }
      }

      // create_task 후 LLM이 '등록 완료'로 단정하는 후속 답변을 막음
      if (createdDraftResult) {
        return createdDraftResult;
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
        const reminderConfig = parseDraftReminderConfig(args);
        const task = await this.taskService.create({
          userId,
          telegramUserId,
          title: a.title,
          description: a.description,
          priority: a.priority,
          dueAt,
          skipReminders: true,
        });
        if (reminderConfig) {
          await this.pendingComposeReminder.set(userId, reminderConfig);
        } else {
          await this.pendingComposeReminder.clear(userId);
        }
        const due = task.dueAt ? `, 마감 ${formatDueLabel(task.dueAt)}` : "";
        const remind = formatReminderConfigLabel(reminderConfig);
        const remindPart = remind ? `, 알림 ${remind}` : "";
        return `초안 준비됨(미등록): ${task.title}${due}${remindPart}. [등록 완료] 전이면 일정에 반영되지 않습니다.`;
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
      case "list_reminders": {
        const a = args as unknown as ListRemindersArgs;
        if (!a.list_index) return "list_index가 필요합니다.";
        const task = await this.taskService.resolveActiveTask(userId, a.list_index);
        if (!task) {
          return `${a.list_index}번 업무를 찾을 수 없습니다.`;
        }
        const pending = (await this.reminders.listPendingForTask(task.id)).sort(
          (x, y) => x.fireAt.getTime() - y.fireAt.getTime(),
        );
        if (pending.length === 0) {
          return `"${task.title}" 예약 알림이 없습니다.`;
        }
        const lines = pending.map(
          (r, i) => `${i + 1}. ${formatDateTime(r.fireAt)}`,
        );
        return [`"${task.title}" 예약 알림:`, ...lines].join("\n");
      }
      case "cancel_reminder": {
        const a = args as unknown as CancelReminderArgs;
        if (!a.list_index) return "list_index가 필요합니다.";
        const task = await this.taskService.resolveActiveTask(userId, a.list_index);
        if (!task) {
          return `${a.list_index}번 업무를 찾을 수 없습니다.`;
        }
        const pending = (await this.reminders.listPendingForTask(task.id)).sort(
          (x, y) => x.fireAt.getTime() - y.fireAt.getTime(),
        );
        if (pending.length === 0) {
          return `"${task.title}" 취소할 예약 알림이 없습니다.`;
        }
        if (a.reminder_index == null) {
          await this.reminderService.cancelForTask(task.id);
          return `"${task.title}" 예약 알림 ${pending.length}건을 모두 취소했습니다.`;
        }
        const target = pending[a.reminder_index - 1];
        if (!target) {
          return `알림 순번 ${a.reminder_index}을(를) 찾을 수 없습니다. list_reminders로 확인하세요.`;
        }
        await this.reminderService.cancelReminder(target.id);
        return `알림 취소: ${formatDateTime(target.fireAt)} ("${task.title}")`;
      }
      case "set_task_reminders": {
        const a = args as unknown as SetTaskRemindersArgs;
        if (!a.list_index) return "list_index가 필요합니다.";
        const reminderConfig = parseDraftReminderConfig(args);
        if (!reminderConfig) {
          return "reminder_config가 필요합니다.";
        }
        const task = await this.taskService.resolveActiveTask(userId, a.list_index);
        if (!task) {
          return `${a.list_index}번 업무를 찾을 수 없습니다.`;
        }
        if (!task.dueAt) {
          return `"${task.title}"에 마감일이 없어 기본/상대 알림을 맞출 수 없습니다. create_reminder로 절대 시각을 추가하세요.`;
        }
        await applyDraftReminderConfig({
          users: this.users,
          reminderService: this.reminderService,
          userId,
          telegramUserId,
          task,
          config: reminderConfig,
          sync: true,
        });
        const label = formatReminderConfigLabel(reminderConfig) ?? "없음";
        return `"${task.title}" 알림을 다시 맞췄습니다: ${label}`;
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
