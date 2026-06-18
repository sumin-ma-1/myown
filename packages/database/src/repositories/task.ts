import { and, asc, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import { tasks } from "../schema.js";
import type { Task, TaskPriority } from "../schema.js";

export class TaskRepository {
  constructor(private readonly db: Database) {}

  async getNextListIndex(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ maxIndex: sql<number>`coalesce(max(${tasks.listIndex}), 0)` })
      .from(tasks)
      .where(eq(tasks.userId, userId));
    return Number(row?.maxIndex ?? 0) + 1;
  }

  /** 여러 업무를 한꺼번에 등록할 때 번호 충돌·문자열 연결 방지 */
  async reserveListIndexes(userId: string, count: number): Promise<number[]> {
    if (count <= 0) return [];
    const start = await this.getNextListIndex(userId);
    return Array.from({ length: count }, (_, i) => start + i);
  }

  async create(input: {
    userId: string;
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueAt?: Date;
    attachmentId?: string;
    listIndex?: number;
  }): Promise<Task> {
    const listIndex = input.listIndex ?? (await this.getNextListIndex(input.userId));
    const [task] = await this.db
      .insert(tasks)
      .values({
        userId: input.userId,
        title: input.title,
        description: input.description,
        priority: input.priority ?? "medium",
        dueAt: input.dueAt,
        attachmentId: input.attachmentId,
        listIndex,
      })
      .returning();
    return task;
  }

  async listActive(userId: string, limit = 20): Promise<Task[]> {
    return this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, "active")))
      .orderBy(asc(tasks.listIndex))
      .limit(limit);
  }

  async listDueToday(userId: string, start: Date, end: Date): Promise<Task[]> {
    return this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.status, "active"),
          isNotNull(tasks.dueAt),
          gte(tasks.dueAt, start),
          lte(tasks.dueAt, end),
        ),
      )
      .orderBy(asc(tasks.dueAt));
  }

  async findById(userId: string, taskId: string): Promise<Task | undefined> {
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .limit(1);
    return task;
  }

  async findByListIndex(userId: string, listIndex: number): Promise<Task | undefined> {
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.listIndex, listIndex),
          eq(tasks.status, "active"),
        ),
      )
      .limit(1);
    return task;
  }

  async findActiveByTitle(userId: string, title: string): Promise<Task | undefined> {
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.status, "active"),
          sql`lower(${tasks.title}) like ${`%${title.toLowerCase()}%`}`,
        ),
      )
      .orderBy(desc(tasks.createdAt))
      .limit(1);
    return task;
  }

  async complete(userId: string, taskId: string): Promise<Task | undefined> {
    const [task] = await this.db
      .update(tasks)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(tasks.id, taskId), eq(tasks.userId, userId), eq(tasks.status, "active")),
      )
      .returning();
    return task;
  }

}
