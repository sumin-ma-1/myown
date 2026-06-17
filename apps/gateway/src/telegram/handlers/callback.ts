import { InlineKeyboard, type Bot } from "grammy";
import type { AppContext } from "../../context.js";
import type { BotContext } from "../bot.js";
import { formatDateTime } from "../../utils/date.js";
import { formatTaskDetail } from "../../utils/format.js";

export function taskActionKeyboard(taskId: string) {
  return new InlineKeyboard()
    .text("✅ 완료", `done:${taskId}`)
    .text("⏰ 1시간 후", `snooze:60:${taskId}`)
    .row()
    .text("📋 상세", `detail:${taskId}`);
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
}

export async function sendReminderMessage(
  bot: Bot,
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
