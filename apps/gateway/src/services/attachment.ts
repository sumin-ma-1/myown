import type { AttachmentRepository, Task, TaskAttachmentRepository } from "@myown/database";
import { join } from "node:path";
import { config } from "../config.js";
import type { TaskService } from "./task.js";
import { deleteAttachmentFile, saveAttachmentFile, SUPPORTED_ATTACHMENT_EXTENSIONS } from "./attachment-storage.js";
import type { ComposeDraft } from "../telegram/compose-session.js";
export type SaveAttachmentResult =
  | { ok: true; attachmentId: string; fileName: string }
  | { ok: false; message: string };

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return base || fileName;
}

export { titleFromFileName };

export class AttachmentService {
  constructor(
    private readonly attachments: AttachmentRepository,
    private readonly taskService: TaskService,
    private readonly taskAttachments: TaskAttachmentRepository,
  ) {}

  isSupported(fileName: string): boolean {
    const ext = fileName.includes(".")
      ? `.${fileName.split(".").pop()?.toLowerCase()}`
      : "";
    return SUPPORTED_ATTACHMENT_EXTENSIONS.has(ext);
  }

  /** 파일만 저장 (업무 생성 없음) */
  async saveOnly(input: {
    userId: string;
    fileName: string;
    mimeType?: string;
    data: Buffer;
    telegramFileId?: string;
  }): Promise<SaveAttachmentResult> {
    if (!this.isSupported(input.fileName)) {
      return {
        ok: false,
        message: ["⚠️ 지원하지 않는 파일 형식입니다.", "지원: HWP, HWPX, PDF, DOCX, TXT, PNG/JPG"].join(
          "\n",
        ),
      };
    }

    if (input.data.length > config.attachmentMaxBytes) {
      const mb = Math.round(config.attachmentMaxBytes / (1024 * 1024));
      return { ok: false, message: `⚠️ 파일이 너무 큽니다. 최대 ${mb}MB까지 지원합니다.` };
    }

    const storagePath = await saveAttachmentFile(input.userId, input.fileName, input.data);
    const attachment = await this.attachments.create({
      userId: input.userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.data.length,
      storagePath,
      telegramFileId: input.telegramFileId,
      status: "ready",
    });

    return { ok: true, attachmentId: attachment.id, fileName: input.fileName };
  }

  /** 초안 → [등록 완료] 시 업무 생성 */
  async registerFromDraft(input: {
    userId: string;
    telegramUserId: number | null;
    draft: ComposeDraft;
  }): Promise<Task> {
    const task = await this.taskService.create({
      userId: input.userId,
      telegramUserId: input.telegramUserId,
      title: input.draft.title,
      description: input.draft.description ?? undefined,
      priority: input.draft.priority,
      dueAt: input.draft.dueAt ?? undefined,
      attachmentId: input.draft.attachmentIds[0],
      skipReminders: true,
    });

    for (const attachmentId of input.draft.attachmentIds.slice(1)) {
      await this.taskService.linkAttachment(input.userId, task.id, attachmentId);
    }

    if (task.dueAt) {
      await this.taskService.scheduleRemindersForTask(task, input.telegramUserId);
    }

    return task;
  }

  getAbsolutePath(storagePath: string): string {
    return join(config.attachmentStorageDir, storagePath);
  }

  async attachToTask(input: {
    userId: string;
    taskId: string;
    fileName: string;
    mimeType?: string;
    data: Buffer;
  }): Promise<{ ok: true; fileName: string; attachmentId: string } | { ok: false; message: string }> {
    if (!this.isSupported(input.fileName)) {
      return { ok: false, message: "지원하지 않는 파일 형식입니다." };
    }
    if (input.data.length > config.attachmentMaxBytes) {
      const mb = Math.round(config.attachmentMaxBytes / (1024 * 1024));
      return { ok: false, message: `파일이 너무 큽니다. 최대 ${mb}MB까지 지원합니다.` };
    }

    const storagePath = await saveAttachmentFile(input.userId, input.fileName, input.data);
    const attachment = await this.attachments.create({
      userId: input.userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.data.length,
      storagePath,
      status: "ready",
    });

    await this.taskService.linkAttachment(input.userId, input.taskId, attachment.id);
    return { ok: true, fileName: input.fileName, attachmentId: attachment.id };
  }

  /** 초안 전용 첨부 삭제 (업무에 연결되지 않은 경우만) */
  async deleteDraftAttachment(userId: string, attachmentId: string): Promise<void> {
    const att = await this.attachments.findById(userId, attachmentId);
    if (!att) return;

    if (await this.taskAttachments.isLinked(attachmentId)) {
      console.warn(`[attachment] skip delete — linked: ${attachmentId}`);
      return;
    }

    await deleteAttachmentFile(att.storagePath);
    await this.attachments.delete(userId, attachmentId);
  }
}
