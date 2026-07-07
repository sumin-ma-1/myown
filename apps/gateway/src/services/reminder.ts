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
    telegramUserId: number | null,
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
      try {
        await this.scheduleAt(task, telegramUserId, fireAt);
      } catch {
        // Skip times that became invalid between planning and scheduling.
      }
    }
  }

  /** Same fireAt (within tolerance) stays pending; only add/remove deltas. */
  async syncRemindersForTask(
    task: Task,
    telegramUserId: number | null,
    user: User,
    options?: { useDefaults?: boolean; extraRules?: ExtraReminderRule[] },
  ): Promise<void> {
    if (task.status !== "active" || !task.dueAt) {
      await this.cancelForTask(task.id);
      return;
    }

    const prefs = (user.preferences ?? {}) as UserPreferences;
    const useDefaults = options?.useDefaults ?? true;
    const storedExtras = prefs.taskReminderRules?.[task.id] ?? [];
    const extraRules = options?.extraRules ?? storedExtras;
    const ddayOffsets = useDefaults
      ? (prefs.notification?.ddayOffsets ?? [3, 1, 0])
      : [];
    const reminderHour = prefs.notification?.reminderHour ?? config.reminderHour;

    const desired = buildReminderFireTimes(task.dueAt, {
      ddayOffsets,
      reminderHour,
      extraRules,
    });
    const pending = await this.reminders.listPendingForTask(task.id);
    const toleranceMs = 60_000;
    const matchedPending = new Set<string>();
    const matchedDesired = new Set<number>();

    for (const reminder of pending) {
      const index = desired.findIndex(
        (fireAt, i) =>
          !matchedDesired.has(i) &&
          Math.abs(reminder.fireAt.getTime() - fireAt.getTime()) <= toleranceMs,
      );
      if (index >= 0) {
        matchedPending.add(reminder.id);
        matchedDesired.add(index);
        await this.ensureReminderJob(reminder, task, telegramUserId);
      }
    }

    for (const reminder of pending) {
      if (!matchedPending.has(reminder.id)) {
        await this.cancelReminder(reminder.id);
      }
    }

    for (let i = 0; i < desired.length; i++) {
      if (!matchedDesired.has(i)) {
        try {
          await this.scheduleAt(task, telegramUserId, desired[i]);
        } catch {
          // Skip times that became invalid between planning and scheduling.
        }
      }
    }
  }

  async rescheduleForTask(
    task: Task,
    telegramUserId: number | null,
    user: User,
    options?: { useDefaults?: boolean; extraRules?: ExtraReminderRule[] },
  ): Promise<void> {
    await this.syncRemindersForTask(task, telegramUserId, user, options);
  }

  async scheduleAt(
    task: Task,
    telegramUserId: number | null,
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

    await this.ensureReminderJob(reminder, task, telegramUserId);
    return fireAt;
  }

  private async ensureReminderJob(
    reminder: { id: string; fireAt: Date; jobId?: string | null },
    task: Task,
    telegramUserId: number | null,
  ): Promise<void> {
    if (!telegramUserId || telegramUserId <= 0 || reminder.jobId) return;

    const jobId = await scheduleReminderJob(
      this.queue,
      {
        reminderId: reminder.id,
        taskId: task.id,
        userId: task.userId,
        telegramUserId,
      },
      reminder.fireAt,
    );

    await this.reminders.setJobId(reminder.id, jobId);
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
    telegramUserId: number | null,
    minutes: number,
  ): Promise<Date> {
    const fireAt = new Date(Date.now() + minutes * 60 * 1000);
    return this.scheduleAt(task, telegramUserId, fireAt);
  }
}
