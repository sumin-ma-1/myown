import type { Bot } from "grammy";
import type { AppContext } from "../../context.js";
import type { BotContext } from "../bot.js";

export function registerMessageHandlers(bot: Bot<BotContext>, app: AppContext) {
  bot.on("message:text", async (ctx) => {
    const userId = ctx.session.userId;
    const telegramUserId = ctx.from?.id;
    if (!userId || !telegramUserId) return;

    if (ctx.message.text.startsWith("/")) return;

    try {
      await ctx.replyWithChatAction("typing");

      const activeTasks = await app.tasks.listActive(userId);
      const reply = await app.agent.handleMessage({
        userId,
        telegramUserId,
        text: ctx.message.text,
        activeTasks,
      });

      await ctx.reply(reply);
    } catch (err) {
      console.error("[message] handler error:", err);
      await ctx.reply(
        "⚠️ 처리 중 오류가 발생했습니다.\n명령어(/list, /add)를 사용하거나 터미널 로그를 확인해 주세요.",
      );
    }
  });
}
