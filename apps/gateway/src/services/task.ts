import type { Task, TaskPriority, TaskRepository } from "@myown/database";
import { endOfDayInTimezone, startOfDayInTimezone } from "../utils/date.js";
import { formatTaskDetail, formatTaskList } from "../utils/format.js";
import type { ReminderService } from "./reminder.js";

export interface CreateTaskInput {
  userId: string;
  telegramUserId: number;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueAt?: Date;
  attachmentId?: string;
}

export class TaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly reminders: ReminderService,
  ) {}

  async create(input: CreateTaskInput): Promise<Task> {
    const task = await this.tasks.create({
      userId: input.userId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueAt: input.dueAt,
      attachmentId: input.attachmentId,
    });

    if (task.dueAt) {
      await this.reminders.scheduleForTask(task, input.telegramUserId);
    }

    return task;
  }

  async listActive(userId: string): Promise<string> {
    const items = await this.tasks.listActive(userId);
    return formatTaskList(items, "📋 활성 업무 목록");
  }

  async listToday(userId: string): Promise<string> {
    const start = startOfDayInTimezone();
    const end = endOfDayInTimezone();
    const items = await this.tasks.listDueToday(userId, start, end);
    return formatTaskList(items, "📅 오늘 마감 업무");
  }

  async completeByIndex(
    userId: string,
    listIndex: number,
  ): Promise<{ ok: true; task: Task } | { ok: false; message: string }> {
    const task = await this.tasks.findByListIndex(userId, listIndex);
    if (!task) {
      return { ok: false, message: `${listIndex}번 업무를 찾을 수 없습니다.` };
    }
    return this.complete(userId, task.id);
  }

  async completeByTitle(
    userId: string,
    title: string,
  ): Promise<{ ok: true; task: Task } | { ok: false; message: string }> {
    const task = await this.tasks.findActiveByTitle(userId, title);
    if (!task) {
      return { ok: false, message: `"${title}" 업무를 찾을 수 없습니다.` };
    }
    return this.complete(userId, task.id);
  }

  async complete(
    userId: string,
    taskId: string,
  ): Promise<{ ok: true; task: Task } | { ok: false; message: string }> {
    const existing = await this.tasks.findById(userId, taskId);
    if (!existing || existing.status !== "active") {
      return { ok: false, message: "업무를 찾을 수 없거나 이미 완료되었습니다." };
    }

    await this.reminders.cancelForTask(taskId);
    const task = await this.tasks.complete(userId, taskId);
    if (!task) {
      return { ok: false, message: "완료 처리에 실패했습니다." };
    }

    return { ok: true, task };
  }

  async getDetail(userId: string, taskId: string): Promise<string | null> {
    const task = await this.tasks.findById(userId, taskId);
    if (!task) return null;
    return formatTaskDetail(task);
  }

  async scheduleReminder(
    userId: string,
    telegramUserId: number,
    listIndex: number,
    fireAt: Date,
  ): Promise<{ ok: true; task: Task; fireAt: Date } | { ok: false; message: string }> {
    const task = await this.tasks.findByListIndex(userId, listIndex);
    if (!task) {
      return { ok: false, message: `${listIndex}번 업무를 찾을 수 없습니다.` };
    }

    try {
      const scheduledAt = await this.reminders.scheduleAt(task, telegramUserId, fireAt);
      return { ok: true, task, fireAt: scheduledAt };
    } catch (err) {
      const message = err instanceof Error ? err.message : "알림 예약에 실패했습니다.";
      return { ok: false, message };
    }
  }
}
