import type { TaskPriority } from "@myown/database";
import { InlineKeyboard } from "grammy";
import type { SessionData } from "./bot.js";
import type { BotContext } from "./bot.js";

export type ComposeMode = "awaiting_text" | "awaiting_attachment";

/** 등록 완료 전 초안 (DB에 업무 없음) */
export interface ComposeDraft {
  attachmentIds: string[];
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: Date | null;
}

export interface ComposeState {
  composeKey: string;
  /** 세션 소유자 (DB user id) — 타 사용자 격리 */
  ownerUserId: string;
  mode: ComposeMode;
  anchorMessageId: number;
  promptMessageId?: number;
  /** [등록 완료] 전까지 DB에 업무 없음 */
  draft: ComposeDraft;
}

export function getCompose(session: SessionData): ComposeState | undefined {
  return session.compose;
}

export function ownsCompose(session: SessionData, compose: ComposeState): boolean {
  return Boolean(session.userId && session.userId === compose.ownerUserId);
}

export function resolveCompose(
  session: SessionData,
  composeKey: string,
): ComposeState | undefined {
  const compose = getCompose(session);
  if (!compose || compose.composeKey !== composeKey) return undefined;
  if (!ownsCompose(session, compose)) return undefined;
  return compose;
}

export function setCompose(
  session: SessionData,
  state: Omit<ComposeState, "ownerUserId">,
): void {
  if (!session.userId) {
    throw new Error("Cannot set compose without session userId");
  }
  session.compose = { ...state, ownerUserId: session.userId };
}

export function clearCompose(session: SessionData): void {
  delete session.compose;
}

export function replyToMessageId(ctx: BotContext): number | undefined {
  return ctx.message?.reply_to_message?.message_id;
}

export function isReplyToComposeAnchor(ctx: BotContext, session: SessionData): boolean {
  const compose = getCompose(session);
  const replyId = replyToMessageId(ctx);
  if (!compose || !ownsCompose(session, compose) || replyId === undefined) return false;
  if (replyId === compose.anchorMessageId) return true;
  if (compose.promptMessageId !== undefined && replyId === compose.promptMessageId) {
    return true;
  }
  return false;
}

export function composeContinueKeyboard(composeKey: string) {
  return new InlineKeyboard()
    .text("답장하기", `compose:reply:${composeKey}`)
    .text("등록 완료", `compose:register:${composeKey}`)
    .row()
    .text("등록 취소", `compose:cancel:${composeKey}`);
}

export const COMPOSE_HINT_REPLY =
  "[답장하기]로 메모 입력 후 [등록 완료]. 취소는 [등록 취소].";

export async function requestComposeReply(
  ctx: BotContext,
  compose: ComposeState,
): Promise<number | undefined> {
  const chatId = ctx.chat?.id;
  if (!chatId) return undefined;

  const placeholder =
    compose.mode === "awaiting_attachment"
      ? "파일 또는 사진 첨부"
      : "업무 메모";

  const sent = await ctx.api.sendMessage(chatId, "이어서 입력해 주세요.", {
    reply_parameters: {
      message_id: compose.anchorMessageId,
    },
    reply_markup: {
      force_reply: true,
      input_field_placeholder: placeholder,
    },
  });
  return sent.message_id;
}

export function parseComposeText(text: string): { title: string; description?: string } {
  const lines = text.trim().split("\n");
  const title = lines[0]?.trim() ?? text.trim();
  const rest = lines.slice(1).join("\n").trim();
  return { title, description: rest || undefined };
}

export function draftMemoContext(draft: ComposeDraft) {
  return {
    title: draft.title,
    description: draft.description ?? null,
    dueAt: draft.dueAt ?? null,
    priority: draft.priority ?? ("medium" as TaskPriority),
  };
}
