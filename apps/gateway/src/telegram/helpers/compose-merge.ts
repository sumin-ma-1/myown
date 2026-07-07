import type { TaskPriority } from "@myown/database";
import type { AppContext } from "../../context.js";
import type { BotContext } from "../bot.js";
import {
  clearCompose,
  draftMemoContext,
  getCompose,
  isReplyToComposeAnchor,
  ownsCompose,
  parseComposeText,
  setCompose,
  type ComposeDraft,
} from "../compose-session.js";
import { formatDate, formatDateTime } from "../../utils/date.js";
import { isDateOnlyDue } from "../../utils/datetime-parse.js";

const priorityLabelKo = {
  urgent: "최우선",
  high: "우선",
  medium: "일반",
  low: "일반",
} as const;

function formatDueLabel(dueAt: Date): string {
  return isDateOnlyDue(dueAt) ? formatDate(dueAt) : formatDateTime(dueAt);
}

export function formatDraftSummary(draft: ComposeDraft): string {
  const lines = ["✅ 업무 내용을 반영했습니다.", `제목: ${draft.title}`];
  if (draft.description) lines.push(`📝 ${draft.description}`);
  if (draft.dueAt) lines.push(`마감: ${formatDueLabel(draft.dueAt)}`);
  lines.push(`우선순위: ${priorityLabelKo[draft.priority ?? "medium"]}`);
  lines.push("", "[등록 완료]를 눌러 업무를 등록해 주세요.");
  return lines.join("\n");
}

async function applyMemoPatch(
  app: AppContext,
  context: { title: string; description?: string | null; dueAt?: Date | null; priority: TaskPriority },
  text: string,
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
  const parsed = await app.agent.parseComposeMemo(context, text);
  if (parsed.ok) return parsed;

  if (parsed.message === "llm_disabled") {
    const { title, description } = parseComposeText(text);
    return { ok: true, patch: { title, description: description ?? null } };
  }

  return parsed;
}

export async function draftFromMemo(
  app: AppContext,
  base: ComposeDraft,
  text: string,
): Promise<ComposeDraft> {
  const result = await applyMemoPatch(app, draftMemoContext(base), text);
  if (!result.ok) {
    const { title, description } = parseComposeText(text);
    return { ...base, title, description: description ?? base.description };
  }

  return {
    ...base,
    title: result.patch.title,
    description: result.patch.description ?? base.description,
    priority: result.patch.priority ?? base.priority,
    dueAt: result.patch.dueAt !== undefined ? result.patch.dueAt : base.dueAt,
  };
}

export async function discardActiveTask(
  app: AppContext,
  userId: string,
  taskId: string,
): Promise<void> {
  await app.reminderService.cancelForTask(taskId);
  await app.tasks.delete(userId, taskId);
}

export async function mergeTextIntoComposeTask(
  app: AppContext,
  ctx: BotContext,
  userId: string,
  text: string,
): Promise<{ ok: true; reply: string } | { ok: false; message: string }> {
  if (!isReplyToComposeAnchor(ctx, ctx.session)) {
    return { ok: false, message: "not_anchor" };
  }

  const compose = getCompose(ctx.session);
  if (!compose || !ownsCompose(ctx.session, compose)) {
    return { ok: false, message: "no_compose" };
  }

  const draft = await draftFromMemo(app, compose.draft, text);
  setCompose(ctx.session, { ...compose, draft });
  return { ok: true, reply: formatDraftSummary(draft) };
}

export async function mergeFileIntoComposeTask(
  app: AppContext,
  ctx: BotContext,
  userId: string,
  file: { fileName: string; mimeType?: string; data: Buffer; telegramFileId?: string },
): Promise<{ ok: true; fileName: string; title: string } | { ok: false; message: string }> {
  if (!isReplyToComposeAnchor(ctx, ctx.session)) {
    return { ok: false, message: "not_anchor" };
  }

  const compose = getCompose(ctx.session);
  if (!compose || !ownsCompose(ctx.session, compose)) {
    return { ok: false, message: "no_compose" };
  }

  const saved = await app.attachmentService.saveOnly({
    userId,
    fileName: file.fileName,
    mimeType: file.mimeType,
    data: file.data,
    telegramFileId: file.telegramFileId,
  });
  if (!saved.ok) return { ok: false, message: saved.message };

  const draft: ComposeDraft = {
    ...compose.draft,
    attachmentIds: [...compose.draft.attachmentIds, saved.attachmentId],
  };
  setCompose(ctx.session, { ...compose, draft });
  return { ok: true, fileName: saved.fileName, title: draft.title };
}
