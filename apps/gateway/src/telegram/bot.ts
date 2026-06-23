import { Bot, type Context, session, type SessionFlavor } from "grammy";
import type { AppContext } from "../context.js";
import { config } from "../config.js";
import { authMiddleware } from "./middleware/auth.js";
import { registerCallbackHandlers } from "./handlers/callback.js";
import { registerCommandHandlers } from "./handlers/command.js";
import { registerDocumentHandlers } from "./handlers/document.js";
import { registerMessageHandlers } from "./handlers/message.js";

export interface SessionData {
  userId?: string;
}

export type BotContext = Context & SessionFlavor<SessionData>;

export function createBot(ctx: AppContext) {
  const bot = new Bot<BotContext>(config.telegramBotToken);

  bot.catch(async (err) => {
    console.error("[bot] handler error:", err);
  });

  bot.use(session({ initial: (): SessionData => ({}) }));
  bot.use(authMiddleware);

  bot.use(async (grammyCtx, next) => {
    const telegramUserId = grammyCtx.from?.id;
    if (!telegramUserId) return;

    const preview = grammyCtx.message?.text?.slice(0, 40) ?? grammyCtx.update.callback_query?.data;
    console.log(`[bot] update from ${telegramUserId}: ${preview ?? "(non-text)"}`);

    try {
      const user = await ctx.users.upsert(telegramUserId, config.timezone);
      const from = grammyCtx.from;
      const displayName = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || undefined;
      await ctx.channelConnections.ensureTelegram(user.id, telegramUserId, displayName);
      grammyCtx.session.userId = user.id;
      await next();
    } catch (err) {
      console.error("[db] user upsert failed:", err);
      await grammyCtx.reply(
        "⚠️ DB 연결 오류입니다.\n\ndocker compose up -d\npnpm db:push\n\n위 명령 실행 후 봇을 재시작해 주세요.",
      );
    }
  });

  registerCommandHandlers(bot, ctx);
  registerMessageHandlers(bot, ctx);
  registerDocumentHandlers(bot, ctx);
  registerCallbackHandlers(bot, ctx);

  return bot;
}
