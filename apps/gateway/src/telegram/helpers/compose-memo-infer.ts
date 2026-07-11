import type { TaskPriority } from "@myown/database";
import { parseComposeText } from "../compose-session.js";
import { looksLikeDueSupplementOnly, parseKoreanDueSupplement } from "../../utils/datetime-parse.js";

export interface ComposeMemoInferContext {
  title: string;
  description?: string | null;
  dueAt?: Date | null;
  priority: TaskPriority;
}

export interface ComposeMemoPatch {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: Date | null;
}

const PRIORITY_PATTERNS: { re: RegExp; priority: TaskPriority }[] = [
  { re: /최우선|긴급|아주\s*급|urgent/i, priority: "urgent" },
  { re: /우선|빨리|high/i, priority: "high" },
  { re: /일반|보통|medium/i, priority: "medium" },
];

export function parsePrioritySupplement(text: string): TaskPriority | undefined {
  const trimmed = text.trim();
  for (const { re, priority } of PRIORITY_PATTERNS) {
    if (re.test(trimmed)) return priority;
  }
  return undefined;
}

export function looksLikePrioritySupplementOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 24) return false;
  return parsePrioritySupplement(trimmed) !== undefined;
}

function looksLikeFileNameTitle(title: string): boolean {
  return /\.[a-z0-9]{2,5}$/i.test(title) || /^photo_/i.test(title);
}

function appendDescription(
  existing: string | null | undefined,
  addition: string,
): string {
  const base = existing?.trim();
  return base ? `${base}\n${addition}` : addition;
}

/** LLM 없을 때 보수적으로 메모 의도 추론 */
export function inferOfflineComposeMemoPatch(
  text: string,
  context: ComposeMemoInferContext,
): ComposeMemoPatch {
  const trimmed = text.trim();
  if (!trimmed) return { title: context.title };

  const dueAt = parseKoreanDueSupplement(trimmed, context.dueAt);
  if (dueAt && looksLikeDueSupplementOnly(trimmed)) {
    return { title: context.title, dueAt };
  }

  const priority = parsePrioritySupplement(trimmed);
  if (priority && looksLikePrioritySupplementOnly(trimmed)) {
    return { title: context.title, priority };
  }

  const labeledTitle = trimmed.match(/^(?:제목|업무명)\s*[:：]\s*(.+)$/);
  if (labeledTitle?.[1]) {
    return { title: labeledTitle[1].trim() };
  }

  const rename = trimmed.match(
    /(?:제목|업무(?:명)?)\s*(?:을|를)?\s*(.+?)(?:로|으로)\s*(?:할게|해줘|변경|바꿔|해)/,
  );
  if (rename?.[1]) {
    return { title: rename[1].trim() };
  }

  if (looksLikeFileNameTitle(context.title)) {
    const { title, description } = parseComposeText(trimmed);
    return {
      title,
      description: description ?? context.description ?? null,
    };
  }

  if (trimmed.includes("\n")) {
    const { title, description } = parseComposeText(trimmed);
    if (description) {
      return {
        title: context.title,
        description: appendDescription(context.description, description),
      };
    }
    return { title: context.title, description: appendDescription(context.description, trimmed) };
  }

  return {
    title: context.title,
    description: appendDescription(context.description, trimmed),
  };
}

/** LLM이 메모 전체를 제목으로 바꾼 경우 교정 */
export function sanitizeComposeMemoPatch(
  memo: string,
  context: ComposeMemoInferContext,
  patch: ComposeMemoPatch,
): ComposeMemoPatch {
  const m = memo.trim();
  const llmTitle = patch.title.trim();
  const supplementalDue = parseKoreanDueSupplement(m, context.dueAt);

  if (looksLikeDueSupplementOnly(m)) {
    return {
      ...patch,
      title: context.title,
      dueAt: patch.dueAt ?? supplementalDue ?? context.dueAt ?? null,
    };
  }

  if (looksLikePrioritySupplementOnly(m)) {
    return {
      ...patch,
      title: context.title,
      priority: patch.priority ?? parsePrioritySupplement(m),
    };
  }

  if (
    llmTitle === m &&
    (patch.dueAt !== undefined || patch.priority !== undefined || patch.description !== undefined)
  ) {
    return { ...patch, title: context.title };
  }

  if (llmTitle === m && m.length <= 32 && !looksLikeFileNameTitle(context.title)) {
    return {
      ...patch,
      title: context.title,
      description: appendDescription(context.description, m),
    };
  }

  return patch;
}

export function applyComposeMemoPatch(
  base: {
    title: string;
    description?: string | null;
    priority?: TaskPriority;
    dueAt?: Date | null;
  },
  patch: ComposeMemoPatch,
) {
  return {
    ...base,
    title: patch.title,
    description: patch.description !== undefined ? patch.description : base.description,
    priority: patch.priority ?? base.priority,
    dueAt: patch.dueAt !== undefined ? patch.dueAt : base.dueAt,
  };
}
