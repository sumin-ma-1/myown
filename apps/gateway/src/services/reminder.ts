import type { ReminderRepository, Task } from "@myown/database";
import type { Queue } from "bullmq";
import { config } from "../config.js";
import { addDays, atHourOnDate } from "../utils/date.js";
import { isDateOnlyDue } from "../utils/datetime-parse.js";
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

  async scheduleForTask(task: Task, telegramUserId: number): Promise<void> {
    if (!task.dueAt) return;

    const schedules = this.buildReminderTimes(task.dueAt);
    for (const fireAt of schedules) {
      if (fireAt.getTime() <= Date.now()) continue;

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
    }
  }

  /**
   * 마감 시각(dueAt)은 "그때까지 완료" 기준.
   * 알림은 마감 전에만 발송: D-3, D-1, 당일 아침(REMINDER_HOUR), (시각 마감 시) 1시간 전.
   */
  private buildReminderTimes(dueAt: Date): Date[] {
    const schedules: Date[] = [
      atHourOnDate(addDays(dueAt, -3), config.reminderHour),
      atHourOnDate(addDays(dueAt, -1), config.reminderHour),
    ];

    const morningOfDueDay = atHourOnDate(dueAt, config.reminderHour);

    if (isDateOnlyDue(dueAt)) {
      schedules.push(morningOfDueDay);
      return schedules;
    }

    // 시각이 있는 마감: 당일 아침 알림은 마감 시각보다 이전일 때만
    if (morningOfDueDay.getTime() < dueAt.getTime()) {
      schedules.push(morningOfDueDay);
    }

    // 마감 1시간 전 추가 알림
    const oneHourBefore = new Date(dueAt.getTime() - 60 * 60 * 1000);
    const alreadyHasMorning = schedules.some(
      (s) => Math.abs(s.getTime() - morningOfDueDay.getTime()) < 60_000,
    );
    if (
      oneHourBefore.getTime() < dueAt.getTime() &&
      (!alreadyHasMorning ||
        Math.abs(oneHourBefore.getTime() - morningOfDueDay.getTime()) > 60_000)
    ) {
      schedules.push(oneHourBefore);
    }

    return schedules;
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

  async scheduleSnooze(
    task: Task,
    telegramUserId: number,
    minutes: number,
  ): Promise<Date> {
    const fireAt = new Date(Date.now() + minutes * 60 * 1000);
    return this.scheduleAt(task, telegramUserId, fireAt);
  }
}
