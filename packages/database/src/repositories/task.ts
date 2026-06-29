import { and, asc, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import { tasks } from "../schema.js";
import type { Task, TaskPriority } from "../schema.js";
import { normalizeTaskPriority } from "../priority.js";

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
        priority: normalizeTaskPriority(input.priority),
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

  async listForUser(
    userId: string,
    options: {
      status?: "active" | "completed" | "all";
      sort?: "priority" | "dueAt" | "listIndex" | "createdAt";
      limit?: number;
    } = {},
  ): Promise<Task[]> {
    const { status = "active", sort = "listIndex", limit = 100 } = options;

    const statusFilter =
      status === "all"
        ? eq(tasks.userId, userId)
        : and(eq(tasks.userId, userId), eq(tasks.status, status));

    const order =
      sort === "priority"
        ? [
            sql`case ${tasks.priority}
              when 'urgent' then 0
              when 'high' then 1
              else 2 end`,
            asc(tasks.dueAt),
          ]
        : sort === "dueAt"
          ? [sql`${tasks.dueAt} nulls last`, asc(tasks.listIndex)]
          : sort === "createdAt"
            ? [desc(tasks.createdAt)]
            : [asc(tasks.listIndex)];

    return this.db.select().from(tasks).where(statusFilter).orderBy(...order).limit(limit);
  }

  async listDueInRange(userId: string, from: Date, to: Date): Promise<Task[]> {
    return this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.status, "active"),
          isNotNull(tasks.dueAt),
          gte(tasks.dueAt, from),
          lte(tasks.dueAt, to),
        ),
      )
      .orderBy(asc(tasks.dueAt));
  }

  async update(
    userId: string,
    taskId: string,
    patch: {
      title?: string;
      description?: string | null;
      priority?: TaskPriority;
      dueAt?: Date | null;
      status?: "active" | "completed" | "cancelled";
      attachmentId?: string | null;
    },
  ): Promise<Task | undefined> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.priority !== undefined) updates.priority = normalizeTaskPriority(patch.priority);
    if (patch.dueAt !== undefined) updates.dueAt = patch.dueAt;
    if (patch.attachmentId !== undefined) updates.attachmentId = patch.attachmentId;
    if (patch.status !== undefined) {
      updates.status = patch.status;
      if (patch.status === "completed") {
        updates.completedAt = new Date();
      }
      if (patch.status === "active") {
        updates.completedAt = null;
      }
    }

    const [task] = await this.db
      .update(tasks)
      .set(updates)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();
    return task;
  }

  async delete(userId: string, taskId: string): Promise<boolean> {
    const result = await this.db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning({ id: tasks.id });
    return result.length > 0;
  }
}
