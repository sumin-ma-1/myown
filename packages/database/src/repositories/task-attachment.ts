import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { attachments, taskAttachments } from "../schema.js";
import type { Attachment } from "../schema.js";

export class TaskAttachmentRepository {
  constructor(private readonly db: Database) {}

  async link(taskId: string, attachmentId: string): Promise<void> {
    await this.db
      .insert(taskAttachments)
      .values({ taskId, attachmentId })
      .onConflictDoNothing();
  }

  async unlink(taskId: string, attachmentId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(taskAttachments)
      .where(
        and(
          eq(taskAttachments.taskId, taskId),
          eq(taskAttachments.attachmentId, attachmentId),
        ),
      )
      .returning();
    return deleted.length > 0;
  }

  async isLinked(attachmentId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ taskId: taskAttachments.taskId })
      .from(taskAttachments)
      .where(eq(taskAttachments.attachmentId, attachmentId))
      .limit(1);
    return Boolean(row);
  }

  async listForTask(
    userId: string,
    taskId: string,
    legacyAttachmentId?: string | null,
  ): Promise<Attachment[]> {
    const rows = await this.db
      .select({ attachment: attachments })
      .from(taskAttachments)
      .innerJoin(attachments, eq(taskAttachments.attachmentId, attachments.id))
      .where(and(eq(taskAttachments.taskId, taskId), eq(attachments.userId, userId)))
      .orderBy(asc(attachments.createdAt));

    const items = rows.map((r) => r.attachment);
    const ids = new Set(items.map((a) => a.id));

    if (legacyAttachmentId && !ids.has(legacyAttachmentId)) {
      const [legacy] = await this.db
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, legacyAttachmentId), eq(attachments.userId, userId)))
        .limit(1);
      if (legacy) items.unshift(legacy);
    }

    return items;
  }
}
