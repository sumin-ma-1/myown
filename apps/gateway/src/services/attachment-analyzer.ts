import type { TaskPriority } from "@myown/database";
import OpenAI from "openai";
import { config, isLlmEnabled } from "../config.js";
import { formatDate, formatDateTime } from "../utils/date.js";
import { isDateOnlyDue } from "../utils/datetime-parse.js";
import { resolveDueAt } from "../agent/tools.js";
import { truncateForLlm } from "./document-extract.js";

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

    const body = truncateForLlm(input.text);
    const response = await Promise.race([
      this.openai.chat.completions.create({
        model: config.llmModel,
        messages: [
          {
            role: "system",
            content: [
              "당신은 한국어 공문·업무 문서 분석기입니다.",
              `오늘 날짜: ${formatDate(new Date())}, 타임존: ${config.timezone}`,
              "문서에서 사용자가 해야 할 업무를 추출하세요.",
              "반드시 JSON만 출력하세요. 마크다운 코드블록 없이도 됩니다.",
              "스키마:",
              '{"summary":"한 줄 요약","keywords":["키워드"],"tasks":[{"title":"업무 제목","description":"설명","due_date":"YYYY-MM-DD","due_time":"HH:MM","priority":"low|medium|high|urgent","source_quote":"근거 문장"}]}',
              "마감이 없으면 due_date, due_time을 생략하세요.",
              "확실하지 않은 업무는 넣지 마세요.",
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              `파일명: ${input.fileName}`,
              input.userHint ? `사용자 메모: ${input.userHint}` : "",
              "문서 본문:",
              body,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
        temperature: 0.2,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("LLM request timed out")), config.llmTimeoutMs),
      ),
    ]);

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
