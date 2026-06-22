import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { reminders } from "../schema.js";
import type { Reminder } from "../schema.js";

export class ReminderRepository {
  constructor(private readonly db: Database) {}

  async create(input: {
    userId: string;
    taskId: string;
    fireAt: Date;
    jobId?: string;
  }): Promise<Reminder> {
    const [reminder] = await this.db
      .insert(reminders)
      .values({
        userId: input.userId,
        taskId: input.taskId,
        fireAt: input.fireAt,
        jobId: input.jobId,
      })
      .returning();
    return reminder;
  }

  async findById(reminderId: string): Promise<Reminder | undefined> {
    const [reminder] = await this.db
      .select()
      .from(reminders)
      .where(eq(reminders.id, reminderId))
      .limit(1);
    return reminder;
  }

  async markSent(reminderId: string): Promise<void> {
    await this.db
      .update(reminders)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(reminders.id, reminderId));
  }

  async cancel(reminderId: string): Promise<void> {
    await this.db
      .update(reminders)
      .set({ status: "cancelled" })
      .where(eq(reminders.id, reminderId));
  }

  async setJobId(reminderId: string, jobId: string): Promise<void> {
    await this.db.update(reminders).set({ jobId }).where(eq(reminders.id, reminderId));
  }

  async listPendingForTask(taskId: string): Promise<Reminder[]> {
    return this.db
      .select()
      .from(reminders)
      .where(and(eq(reminders.taskId, taskId), eq(reminders.status, "pending")));
  }

  async listForTask(taskId: string): Promise<Reminder[]> {
    return this.db
      .select()
      .from(reminders)
      .where(eq(reminders.taskId, taskId))
      .orderBy(asc(reminders.fireAt));
  }
}
