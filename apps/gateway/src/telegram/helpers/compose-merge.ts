import type { TaskPriority } from "@myown/database";
import type { AppContext } from "../../context.js";
import type { BotContext } from "../bot.js";
import {
  clearCompose,
  draftMemoContext,
  getCompose,
  ownsCompose,
  setCompose,
  type ComposeDraft,
} from "../compose-session.js";
import { formatDate, formatDateTime } from "../../utils/date.js";
import { isDateOnlyDue } from "../../utils/datetime-parse.js";
import {
  applyComposeMemoPatch,
  inferOfflineComposeMemoPatch,
} from "./compose-memo-infer.js";
import { resolveUserTimezone } from "../../utils/user-timezone.js";

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
  const lines = [
    "📝 일정 초안입니다.",
    `제목: ${draft.title}`,
  ];
  if (draft.description) lines.push(`📝 ${draft.description}`);
  if (draft.dueAt) lines.push(`마감: ${formatDueLabel(draft.dueAt)}`);
  lines.push(`우선순위: ${priorityLabelKo[draft.priority ?? "medium"]}`);
  lines.push("", "[등록 완료]를 눌러 업무를 등록해 주세요.");
  return lines.join("\n");
}

async function applyMemoPatch(
  app: AppContext,
  userId: string,
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
  const timezone = await resolveUserTimezone(app.users, userId);
  const parsed = await app.agent.parseComposeMemo(context, text, timezone);
  if (parsed.ok) return parsed;

  return { ok: true, patch: inferOfflineComposeMemoPatch(text, context) };
}

export async function draftFromMemo(
  app: AppContext,
  userId: string,
  base: ComposeDraft,
  text: string,
): Promise<ComposeDraft> {
  const context = draftMemoContext(base);
  const result = await applyMemoPatch(app, userId, context, text);
  const patch = result.ok
    ? result.patch
    : inferOfflineComposeMemoPatch(text, context);
  return { ...base, ...applyComposeMemoPatch(base, patch) };
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
  const compose = getCompose(ctx.session);
  if (!compose || !ownsCompose(ctx.session, compose)) {
    return { ok: false, message: "no_compose" };
  }

  const draft = await draftFromMemo(app, userId, compose.draft, text);
  setCompose(ctx.session, { ...compose, draft });
  return { ok: true, reply: formatDraftSummary(draft) };
}

export async function mergeFileIntoComposeTask(
  app: AppContext,
  ctx: BotContext,
  userId: string,
  file: { fileName: string; mimeType?: string; data: Buffer; telegramFileId?: string },
): Promise<{ ok: true; fileName: string; title: string } | { ok: false; message: string }> {
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
