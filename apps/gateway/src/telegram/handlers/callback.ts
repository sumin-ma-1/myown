import { InlineKeyboard, type Bot } from "grammy";
import type { AppContext } from "../../context.js";
import type { BotContext } from "../bot.js";
import {
  clearCompose,
  resolveCompose,
} from "../compose-session.js";
import { cancelComposeRegistration } from "../helpers/compose-cancel.js";
import { finalizeComposeRegistration } from "../helpers/compose-finalize.js";
import { formatDateTime } from "../../utils/date.js";
import { taskWebLink } from "../../utils/web-links.js";

export function taskActionKeyboard(taskId: string) {
  const kb = new InlineKeyboard()
    .text("✅ 완료", `done:${taskId}`)
    .text("⏰ 1시간 후", `snooze:60:${taskId}`);

  const webUrl = taskWebLink(taskId);
  if (webUrl) {
    kb.row().url("🌐 웹에서 보기", webUrl);
  }

  return kb.row().text("📋 상세", `detail:${taskId}`);
}

export function registerCallbackHandlers(bot: Bot<BotContext>, app: AppContext) {
  bot.callbackQuery(/^done:(.+)$/, async (ctx) => {
    const userId = ctx.session.userId;
    if (!userId) return;

    const taskId = ctx.match[1];
    const result = await app.taskService.complete(userId, taskId);

    await ctx.answerCallbackQuery(
      result.ok ? "완료 처리되었습니다." : result.message,
    );

    if (result.ok) {
      await ctx.editMessageText(`✅ ${result.task.title} 완료 처리했습니다.`);
    }
  });

  bot.callbackQuery(/^snooze:(\d+):(.+)$/, async (ctx) => {
    const userId = ctx.session.userId;
    const telegramUserId = ctx.from?.id;
    if (!userId || !telegramUserId) return;

    const minutes = Number(ctx.match[1]);
    const taskId = ctx.match[2];
    const task = await app.tasks.findById(userId, taskId);

    if (!task || task.status !== "active") {
      await ctx.answerCallbackQuery({ text: "업무를 찾을 수 없습니다.", show_alert: true });
      return;
    }

    const fireAt = await app.reminderService.scheduleSnooze(task, telegramUserId, minutes);
    await ctx.answerCallbackQuery(`⏰ ${formatDateTime(fireAt)}에 다시 알려드릴게요.`);
  });

  bot.callbackQuery(/^detail:(.+)$/, async (ctx) => {
    const userId = ctx.session.userId;
    if (!userId) return;

    const taskId = ctx.match[1];
    const detail = await app.taskService.getDetail(userId, taskId);

    await ctx.answerCallbackQuery();
    if (detail) {
      await ctx.reply(detail, { reply_markup: taskActionKeyboard(taskId) });
    }
  });

  bot.callbackQuery(/^compose:register:(.+)$/, async (ctx) => {
    const userId = ctx.session.userId;
    const telegramUserId = ctx.from?.id;
    if (!userId || !telegramUserId) return;

    const composeKey = ctx.match[1];
    const compose = resolveCompose(ctx.session, composeKey);

    if (!compose) {
      await ctx.answerCallbackQuery({
        text: "등록 대기가 만료되었습니다. 파일을 다시 보내주세요.",
        show_alert: true,
      });
      return;
    }

    const result = await finalizeComposeRegistration(app, {
      userId,
      telegramUserId,
      compose,
    });

    if (!result.ok) {
      await ctx.answerCallbackQuery({ text: result.message, show_alert: true });
      return;
    }

    clearCompose(ctx.session);
    await ctx.answerCallbackQuery("업무를 등록했습니다.");
    try {
      await ctx.editMessageText(result.summary);
    } catch {
      await ctx.reply(result.summary);
    }
  });

  bot.callbackQuery(/^compose:cancel:(.+)$/, async (ctx) => {
    const userId = ctx.session.userId;
    if (!userId) return;

    const composeKey = ctx.match[1];
    const compose = resolveCompose(ctx.session, composeKey);

    if (!compose) {
      await ctx.answerCallbackQuery({
        text: "이미 종료되었거나 권한이 없습니다.",
        show_alert: true,
      });
      return;
    }

    try {
      await cancelComposeRegistration(app, userId, ctx.session, compose);
      await ctx.answerCallbackQuery("등록을 취소했습니다.");
      try {
        await ctx.editMessageText("등록을 취소했습니다.");
      } catch {
        await ctx.reply("등록을 취소했습니다.");
      }
    } catch (err) {
      console.error("[compose] cancel failed:", err);
      await ctx.answerCallbackQuery({
        text: "취소 처리 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  });
}

export async function sendReminderMessage(
  bot: Bot<BotContext>,
  telegramUserId: number,
  title: string,
  dueLabel: string,
  taskId: string,
) {
  const keyboard = taskActionKeyboard(taskId);
  await bot.api.sendMessage(
    telegramUserId,
    ["🔔 업무 알림", "", `📌 ${title}`, dueLabel].join("\n"),
    { reply_markup: keyboard },
  );
}
