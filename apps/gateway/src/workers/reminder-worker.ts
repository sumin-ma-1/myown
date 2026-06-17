import type { Bot } from "grammy";
import type { Job } from "bullmq";
import type { AppContext } from "../context.js";
import type { ReminderJobData } from "../services/reminder-queue.js";
import { sendReminderMessage } from "../telegram/handlers/callback.js";
import { formatDate, formatDateTime } from "../utils/date.js";
import { isDateOnlyDue } from "../utils/datetime-parse.js";

export async function handleReminderJob(
  bot: Bot,
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

  await sendReminderMessage(bot, telegramUserId, task.title, dueLabel, task.id);
  await app.reminders.markSent(reminderId);
}
