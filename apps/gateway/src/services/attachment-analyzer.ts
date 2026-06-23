import type { TaskPriority } from "@myown/database";
import OpenAI from "openai";
import { config, isLlmEnabled } from "../config.js";
import { formatDate, formatDateTime } from "../utils/date.js";
import { isDateOnlyDue } from "../utils/datetime-parse.js";
import { resolveDueAt } from "../agent/tools.js";
import { compactTextForAnalysis } from "./document-extract.js";

export interface ExtractedTask {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: TaskPriority;
  source_quote?: string;
}

export interface DocumentAnalysis {
  summary: string;
  keywords: string[];
  tasks: ExtractedTask[];
}

function formatDueLabel(dueAt: Date): string {
  return isDateOnlyDue(dueAt) ? formatDate(dueAt) : formatDateTime(dueAt);
}

function parseAnalysisJson(raw: string): DocumentAnalysis {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = (fenced?.[1] ?? raw).trim();
  const parsed = JSON.parse(jsonText) as Partial<DocumentAnalysis>;

  const tasks = Array.isArray(parsed.tasks)
    ? parsed.tasks
        .filter((t): t is ExtractedTask => Boolean(t && typeof t.title === "string" && t.title.trim()))
        .map((t) => ({
          title: t.title.trim(),
          description: t.description?.trim() || undefined,
          due_date: t.due_date,
          due_time: t.due_time,
          priority: t.priority,
          source_quote: t.source_quote,
        }))
    : [];

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((k): k is string => typeof k === "string")
      : [],
    tasks,
  };
}

export class AttachmentAnalyzer {
  private readonly openai: OpenAI | null;

  constructor() {
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

  isEnabled(): boolean {
    return isLlmEnabled() && this.openai !== null;
  }

  async analyze(input: {
    fileName: string;
    text: string;
    userHint?: string;
  }): Promise<DocumentAnalysis> {
    if (!this.openai) {
      throw new Error("문서에서 업무를 추출하려면 LLM 설정이 필요합니다.");
    }

    const body = compactTextForAnalysis(input.text);
    const model = config.attachmentLlmModel || config.llmModel;
    const started = Date.now();

    const response = await Promise.race([
      this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: [
              "한국어 공문에서 해야 할 업무만 JSON으로 추출하세요.",
              `오늘: ${formatDate(new Date())}`,
              '{"summary":"요약","keywords":[],"tasks":[{"title":"","due_date":"YYYY-MM-DD","priority":"medium","source_quote":""}]}',
              "priority: urgent=최우선, high=우선, medium=계획",
              "확실한 업무만. 마감 없으면 due_date 생략.",
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              `파일: ${input.fileName}`,
              input.userHint ? `메모: ${input.userHint}` : "",
              body,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
        temperature: 0.1,
        max_tokens: config.attachmentLlmMaxTokens,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("문서 분석 LLM 시간 초과")),
          config.attachmentLlmTimeoutMs,
        ),
      ),
    ]);

    console.log(`[attachment] LLM analyze ${model} ${Date.now() - started}ms`);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM이 분석 결과를 반환하지 않았습니다.");
    }

    return parseAnalysisJson(content);
  }
}

export function formatAnalysisReply(input: {
  fileName: string;
  analysis: DocumentAnalysis;
  createdTasks: Array<{ listIndex: number; title: string; dueAt?: Date }>;
  textPreview?: string;
  llmSkipped?: boolean;
}): string {
  const lines: string[] = [`📎 ${input.fileName}`];

  if (input.analysis.summary) {
    lines.push("", `📝 ${input.analysis.summary}`);
  }

  if (input.createdTasks.length > 0) {
    lines.push("", `✅ ${input.createdTasks.length}건의 업무를 등록했습니다:`);
    for (const task of input.createdTasks) {
      const due = task.dueAt ? ` (${formatDueLabel(task.dueAt)})` : "";
      lines.push(`${task.listIndex}. ${task.title}${due}`);
    }
  } else if (input.llmSkipped) {
    lines.push(
      "",
      "⚠️ LLM이 설정되지 않아 업무 자동 등록은 건너뛰었습니다.",
      "텍스트만 저장했습니다. /add 로 직접 등록해 주세요.",
    );
  } else {
    lines.push("", "추출된 업무가 없습니다. 필요하면 /add 로 직접 등록해 주세요.");
  }

  if (input.textPreview) {
    lines.push("", "— 미리보기 —", input.textPreview);
  }

  return lines.join("\n");
}

export function resolveExtractedDueAt(task: ExtractedTask): Date | undefined {
  return resolveDueAt(task.due_date, task.due_time);
}
