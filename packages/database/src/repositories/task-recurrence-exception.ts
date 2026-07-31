import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../client.js";
import {
  taskRecurrenceExceptions,
  type RecurrenceExceptionAction,
  type TaskRecurrenceException,
} from "../schema.js";

export class TaskRecurrenceExceptionRepository {
  constructor(private readonly db: Database) {}

  async listForTask(taskId: string): Promise<TaskRecurrenceException[]> {
    return this.db
      .select()
      .from(taskRecurrenceExceptions)
      .where(eq(taskRecurrenceExceptions.taskId, taskId));
  }

  async listForTasks(taskIds: string[]): Promise<TaskRecurrenceException[]> {
    if (taskIds.length === 0) return [];
    return this.db
      .select()
      .from(taskRecurrenceExceptions)
      .where(inArray(taskRecurrenceExceptions.taskId, taskIds));
  }

  async upsert(input: {
    taskId: string;
    occurrenceStartsAt: Date;
    action: RecurrenceExceptionAction;
    title?: string | null;
    startsAt?: Date | null;
    dueAt?: Date | null;
    allDay?: boolean | null;
  }): Promise<TaskRecurrenceException> {
    const [row] = await this.db
      .insert(taskRecurrenceExceptions)
      .values({
        taskId: input.taskId,
        occurrenceStartsAt: input.occurrenceStartsAt,
        action: input.action,
        title: input.title ?? null,
        startsAt: input.startsAt ?? null,
        dueAt: input.dueAt ?? null,
        allDay: input.allDay ?? null,
      })
      .onConflictDoUpdate({
        target: [
          taskRecurrenceExceptions.taskId,
          taskRecurrenceExceptions.occurrenceStartsAt,
        ],
        set: {
          action: input.action,
          title: input.title ?? null,
          startsAt: input.startsAt ?? null,
          dueAt: input.dueAt ?? null,
          allDay: input.allDay ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async find(
    taskId: string,
    occurrenceStartsAt: Date,
  ): Promise<TaskRecurrenceException | undefined> {
    const [row] = await this.db
      .select()
      .from(taskRecurrenceExceptions)
      .where(
        and(
          eq(taskRecurrenceExceptions.taskId, taskId),
          eq(taskRecurrenceExceptions.occurrenceStartsAt, occurrenceStartsAt),
        ),
      )
      .limit(1);
    return row;
  }

  async delete(taskId: string, occurrenceStartsAt: Date): Promise<boolean> {
    const result = await this.db
      .delete(taskRecurrenceExceptions)
      .where(
        and(
          eq(taskRecurrenceExceptions.taskId, taskId),
          eq(taskRecurrenceExceptions.occurrenceStartsAt, occurrenceStartsAt),
        ),
      )
      .returning({ id: taskRecurrenceExceptions.id });
    return result.length > 0;
  }
}
