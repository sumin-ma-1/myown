import type { ReminderRepository, Task, User } from "@myown/database";
import type { Queue } from "bullmq";
import { config } from "../config.js";
import type { UserPreferences } from "../api/types.js";
import {
  type ExtraReminderRule,
  buildReminderFireTimes,
} from "./reminder-schedule.js";
import {
  type ReminderJobData,
  cancelReminderJob,
  scheduleReminderJob,
} from "./reminder-queue.js";

export class ReminderService {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly queue: Queue<ReminderJobData>,
  ) {}

  async scheduleForTask(
    task: Task,
    telegramUserId: number,
    user?: User,
    options?: { useDefaults?: boolean; extraRules?: ExtraReminderRule[] },
  ): Promise<void> {
    if (!task.dueAt) return;

    const prefs = (user?.preferences ?? {}) as UserPreferences;
    const useDefaults = options?.useDefaults ?? true;
    const storedExtras = prefs.taskReminderRules?.[task.id] ?? [];
    const extraRules = options?.extraRules ?? storedExtras;

    const ddayOffsets = useDefaults
      ? (prefs.notification?.ddayOffsets ?? [3, 1, 0])
      : [];
    const reminderHour = prefs.notification?.reminderHour ?? config.reminderHour;

    const schedules = buildReminderFireTimes(task.dueAt, {
      ddayOffsets,
      reminderHour,
      extraRules,
    });

    for (const fireAt of schedules) {
      await this.scheduleAt(task, telegramUserId, fireAt);
    }
  }

  async rescheduleForTask(
    task: Task,
    telegramUserId: number,
    user: User,
    options?: { useDefaults?: boolean; extraRules?: ExtraReminderRule[] },
  ): Promise<void> {
    await this.cancelForTask(task.id);
    if (task.status === "active" && task.dueAt) {
      await this.scheduleForTask(task, telegramUserId, user, options);
    }
  }

  async scheduleAt(
    task: Task,
    telegramUserId: number,
    fireAt: Date,
  ): Promise<Date> {
    if (fireAt.getTime() <= Date.now()) {
      throw new Error("알림 시각은 현재보다 미래여야 합니다.");
    }

    const reminder = await this.reminders.create({
      userId: task.userId,
      taskId: task.id,
      fireAt,
    });

    const jobId = await scheduleReminderJob(
      this.queue,
      {
        reminderId: reminder.id,
        taskId: task.id,
        userId: task.userId,
        telegramUserId,
      },
      fireAt,
    );

    await this.reminders.setJobId(reminder.id, jobId);
    return fireAt;
  }

  async cancelForTask(taskId: string): Promise<void> {
    const pending = await this.reminders.listPendingForTask(taskId);
    for (const reminder of pending) {
      if (reminder.jobId) {
        await cancelReminderJob(this.queue, reminder.jobId);
      }
      await this.reminders.cancel(reminder.id);
    }
  }

  async cancelReminder(reminderId: string): Promise<void> {
    const reminder = await this.reminders.findById(reminderId);
    if (!reminder || reminder.status !== "pending") return;
    if (reminder.jobId) {
      await cancelReminderJob(this.queue, reminder.jobId);
    }
    await this.reminders.cancel(reminderId);
  }

  async scheduleSnooze(
    task: Task,
    telegramUserId: number,
    minutes: number,
  ): Promise<Date> {
    const fireAt = new Date(Date.now() + minutes * 60 * 1000);
    return this.scheduleAt(task, telegramUserId, fireAt);
  }
}
