import { randomUUID } from "node:crypto";
import type { Bot } from "grammy";
import type { AppContext } from "../../context.js";
import type { BotContext } from "../bot.js";
import {
  clearCompose,
  composeContinueKeyboard,
  setCompose,
  getCompose,
} from "../compose-session.js";
import {
  discardActiveTask,
  formatDraftSummary,
  mergeTextIntoComposeTask,
} from "../helpers/compose-merge.js";
import { resolveUserTimezone } from "../../utils/user-timezone.js";

export function registerMessageHandlers(bot: Bot<BotContext>, app: AppContext) {
  bot.on("message:text", async (ctx) => {
    const userId = ctx.session.userId;
    const telegramUserId = ctx.from?.id;
    if (!userId || !telegramUserId) return;

    if (ctx.message.text.startsWith("/")) return;

    const text = ctx.message.text.trim();
    if (!text) return;

    if (getCompose(ctx.session)) {
      try {
        await ctx.replyWithChatAction("typing");
        const merged = await mergeTextIntoComposeTask(app, ctx, userId, text);
        if (merged.ok) {
          const compose = getCompose(ctx.session);
          await ctx.reply(merged.reply, {
            reply_markup: compose
              ? composeContinueKeyboard(compose.composeKey)
              : undefined,
          });
          return;
        }
        await ctx.reply(`⚠️ ${merged.message}`);
        return;
      } catch (err) {
        console.error("[message] compose merge error:", err);
        await ctx.reply("⚠️ 메모 반영 중 오류가 발생했습니다.");
        return;
      }
    }

    try {
      await ctx.replyWithChatAction("typing");

      clearCompose(ctx.session);

      const activeBefore = await app.tasks.listActive(userId);
      const beforeIds = new Set(activeBefore.map((t) => t.id));
      const recentTurns = await app.chatMemory.getTurns(userId);

      const timezone = await resolveUserTimezone(app.users, userId);
      const reply = await app.agent.handleMessage({
        userId,
        telegramUserId,
        text,
        activeTasks: activeBefore,
        recentTurns,
        timezone,
      });

      const activeAfter = await app.taskService.getActiveTasks(userId);
      const created = activeAfter.filter((t) => !beforeIds.has(t.id));

      if (created.length === 1) {
        const task = created[0]!;
        const attachments = await app.taskAttachments.listForTask(
          userId,
          task.id,
          task.attachmentId,
        );
        if (attachments.length === 0) {
          await discardActiveTask(app, userId, task.id);

          const draft = {
            attachmentIds: [] as string[],
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueAt: task.dueAt,
          };

          const composeKey = randomUUID();
          const prompt = await ctx.reply(formatDraftSummary(draft), {
            reply_markup: composeContinueKeyboard(composeKey),
          });
          setCompose(ctx.session, {
            composeKey,
            mode: "awaiting_attachment",
            anchorMessageId: prompt.message_id,
            draft,
          });
          await app.chatMemory.clear(userId);
          return;
        }
      }

      await app.chatMemory.appendTurns(userId, [
        { role: "user", text },
        { role: "assistant", text: reply },
      ]);
      await ctx.reply(reply);
    } catch (err) {
      console.error("[message] handler error:", err);
      await ctx.reply(
        "⚠️ 처리 중 오류가 발생했습니다.\n명령어(/list, /add)를 사용하거나 터미널 로그를 확인해 주세요.",
      );
    }
  });
}
