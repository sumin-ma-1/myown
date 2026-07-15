import type { Bot } from "grammy";
import type { Job } from "bullmq";
import type { AppContext } from "../context.js";
import type { ReminderJobData } from "../services/reminder-queue.js";
import type { BotContext } from "../telegram/bot.js";
import { sendReminderMessage } from "../telegram/handlers/callback.js";
import { formatDate, formatDateTime, daysUntil, formatDday } from "../utils/date.js";
import { isDateOnlyDue } from "../utils/datetime-parse.js";

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "최우선",
  high: "우선",
  medium: "일반",
  low: "일반",
};

export async function handleReminderJob(
  bot: Bot<BotContext>,
  app: AppContext,
  job: Job<ReminderJobData>,
): Promise<void> {
  const { reminderId, taskId, userId, telegramUserId } = job.data;

  const reminder = await app.reminders.findById(reminderId);
  if (!reminder || reminder.status !== "pending") return;

  const task = await app.tasks.findById(userId, taskId);
  if (!task || task.status !== "active") {
    await app.reminders.cancel(reminderId);
    return;
  }

  const dueLabel = task.dueAt
    ? `📅 마감: ${isDateOnlyDue(task.dueAt) ? formatDate(task.dueAt) : formatDateTime(task.dueAt)}`
    : "📅 마감: 없음";
  const ddayLabel = task.dueAt ? formatDday(daysUntil(task.dueAt)) : null;
  const hasDescription = Boolean(task.description?.trim());

  await sendReminderMessage(bot, telegramUserId, {
    taskId: task.id,
    title: task.title,
    dueLabel,
    ddayLabel,
    priorityLabel: PRIORITY_LABEL[task.priority] ?? "일반",
    showDetail: hasDescription,
  });
  await app.reminders.markSent(reminderId);
}
