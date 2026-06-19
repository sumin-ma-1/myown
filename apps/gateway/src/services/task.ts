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
  /** true면 리마인더 예약 생략 (일괄 등록 시) */
  skipReminders?: boolean;
  /** 미지정 시 자동 부여 */
  listIndex?: number;
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
      listIndex: input.listIndex,
    });

    if (task.dueAt && !input.skipReminders) {
      await this.reminders.scheduleForTask(task, input.telegramUserId);
    }

    return task;
  }

  async scheduleRemindersForTask(task: Task, telegramUserId: number): Promise<void> {
    if (task.dueAt) {
      await this.reminders.scheduleForTask(task, telegramUserId);
    }
  }

  async reserveListIndexes(userId: string, count: number): Promise<number[]> {
    return this.tasks.reserveListIndexes(userId, count);
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

  async getActiveTasks(userId: string): Promise<Task[]> {
    return this.tasks.listActive(userId);
  }

  private async activeIndicesHint(userId: string): Promise<string> {
    const active = await this.tasks.listActive(userId);
    if (active.length === 0) return "활성 업무가 없습니다. /add 로 등록해 주세요.";
    return `활성 번호: ${active.map((t) => t.listIndex).join(", ")} (/list)`;
  }

  /** DB list_index 또는 목록 순서(1=첫 번째 활성 업무) */
  async resolveActiveTask(userId: string, ref: number): Promise<Task | undefined> {
    const byIndex = await this.tasks.findByListIndex(userId, ref);
    if (byIndex) return byIndex;

    const active = await this.tasks.listActive(userId);
    if (ref >= 1 && ref <= active.length) {
      return active[ref - 1];
    }
    return undefined;
  }

  async resolveActiveTaskByHint(userId: string, text: string): Promise<Task | undefined> {
    const active = await this.tasks.listActive(userId);
    const normalized = text.toLowerCase();

    const matches = active.filter((task) => {
      const title = task.title.toLowerCase();
      if (normalized.includes(title)) return true;
      return title
        .split(/\s+/)
        .some((word) => word.length >= 2 && normalized.includes(word));
    });

    if (matches.length === 1) return matches[0];
    return undefined;
  }

  async completeByIndex(
    userId: string,
    listIndex: number,
  ): Promise<{ ok: true; task: Task } | { ok: false; message: string }> {
    const task = await this.resolveActiveTask(userId, listIndex);
    if (!task) {
      return {
        ok: false,
        message: `${listIndex}번 업무를 찾을 수 없습니다.\n${await this.activeIndicesHint(userId)}`,
      };
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
    const task = await this.resolveActiveTask(userId, listIndex);
    if (!task) {
      return {
        ok: false,
        message: `${listIndex}번 업무를 찾을 수 없습니다.\n${await this.activeIndicesHint(userId)}`,
      };
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
