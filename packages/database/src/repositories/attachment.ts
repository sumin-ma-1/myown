import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { attachments } from "../schema.js";
import type { Attachment, AttachmentStatus } from "../schema.js";

export class AttachmentRepository {
  constructor(private readonly db: Database) {}

  async create(input: {
    userId: string;
    fileName: string;
    mimeType?: string;
    fileSize?: number;
    storagePath: string;
    telegramFileId?: string;
    status?: AttachmentStatus;
  }): Promise<Attachment> {
    const [row] = await this.db
      .insert(attachments)
      .values({
        userId: input.userId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storagePath: input.storagePath,
        telegramFileId: input.telegramFileId,
        status: input.status ?? "pending",
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    userId: string,
    patch: {
      status?: AttachmentStatus;
      extractedText?: string;
      summary?: string;
      keywords?: string[];
      errorMessage?: string | null;
    },
  ): Promise<Attachment | undefined> {
    const [row] = await this.db
      .update(attachments)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
      .returning();
    return row;
  }

  async findById(userId: string, id: string): Promise<Attachment | undefined> {
    const [row] = await this.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .limit(1);
    return row?.userId === userId ? row : undefined;
  }

  async listRecent(userId: string, limit = 10): Promise<Attachment[]> {
    return this.db
      .select()
      .from(attachments)
      .where(eq(attachments.userId, userId))
      .orderBy(desc(attachments.createdAt))
      .limit(limit);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
      .returning({ id: attachments.id });
    return deleted.length > 0;
  }
}
