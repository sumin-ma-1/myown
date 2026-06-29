import { Bot, type Context, session, type SessionFlavor } from "grammy";
import type { AppContext } from "../context.js";
import { config } from "../config.js";
import { telegramDisplayName } from "../integrations/privacy.js";
import { authMiddleware } from "./middleware/auth.js";
import { registerCallbackHandlers } from "./handlers/callback.js";
import { registerCommandHandlers } from "./handlers/command.js";
import { registerDocumentHandlers } from "./handlers/document.js";
import { registerMessageHandlers } from "./handlers/message.js";

export interface SessionData {
  userId?: string;
  /** 첨부·텍스트를 하나의 업무로 이어 받기 (답장 앵커) */
  compose?: {
    composeKey: string;
    ownerUserId: string;
    mode: "awaiting_text" | "awaiting_attachment";
    anchorMessageId: number;
    promptMessageId?: number;
    draft: {
      attachmentIds: string[];
      title: string;
      description?: string | null;
      priority?: "urgent" | "high" | "medium" | "low";
      dueAt?: Date | null;
    };
  };
}

export type BotContext = Context & SessionFlavor<SessionData>;

export function createBot(ctx: AppContext) {
  const bot = new Bot<BotContext>(config.telegramBotToken);

  bot.catch(async (err) => {
    console.error("[bot] handler error:", err);
  });

  bot.use(
    session({
      initial: (): SessionData => ({}),
      /** 채팅이 아닌 Telegram 사용자 ID 기준 — 다중 사용자 격리 */
      getSessionKey: (ctx) => {
        const fromId = ctx.from?.id;
        return fromId ? String(fromId) : undefined;
      },
    }),
  );
  bot.use(authMiddleware);

  bot.use(async (grammyCtx, next) => {
    const telegramUserId = grammyCtx.from?.id;
    if (!telegramUserId) return;

    const preview = grammyCtx.message?.text?.slice(0, 40) ?? grammyCtx.update.callback_query?.data;
    console.log(`[bot] update from ${telegramUserId}: ${preview ?? "(non-text)"}`);

    try {
      const user = await ctx.users.upsert(telegramUserId, config.timezone);
      const displayName = telegramDisplayName(grammyCtx.from);
      await ctx.channelConnections.ensureTelegram(user.id, telegramUserId, displayName);
      grammyCtx.session.userId = user.id;
      await next();
    } catch (err) {
      console.error("[db] middleware failed:", err);
      const detail = err instanceof Error ? err.message : "알 수 없는 오류";
      await grammyCtx.reply(`⚠️ 처리 중 오류가 발생했습니다.\n${detail}`);
    }
  });

  registerCommandHandlers(bot, ctx);
  registerMessageHandlers(bot, ctx);
  registerDocumentHandlers(bot, ctx);
  registerCallbackHandlers(bot, ctx);

  return bot;
}
