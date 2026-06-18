import type { AttachmentRepository } from "@myown/database";
import { join } from "node:path";
import { config } from "../config.js";
import type { TaskService } from "./task.js";
import {
  AttachmentAnalyzer,
  type DocumentAnalysis,
  formatAnalysisReply,
  resolveExtractedDueAt,
} from "./attachment-analyzer.js";
import {
  detectDocumentKind,
  saveAttachmentFile,
  SUPPORTED_ATTACHMENT_EXTENSIONS,
} from "./attachment-storage.js";
import { extractDocumentText } from "./document-extract.js";

function truncateForStorage(text: string): string {
  if (text.length <= config.attachmentMaxTextChars) return text;
  return text.slice(0, config.attachmentMaxTextChars);
}

export interface ProcessAttachmentInput {
  userId: string;
  telegramUserId: number;
  fileName: string;
  mimeType?: string;
  data: Buffer;
  telegramFileId?: string;
  userHint?: string;
  onProgress?: (message: string) => Promise<void>;
}

export class AttachmentService {
  private readonly analyzer = new AttachmentAnalyzer();

  constructor(
    private readonly attachments: AttachmentRepository,
    private readonly taskService: TaskService,
  ) {}

  isSupported(fileName: string): boolean {
    const ext = fileName.includes(".")
      ? `.${fileName.split(".").pop()?.toLowerCase()}`
      : "";
    return SUPPORTED_ATTACHMENT_EXTENSIONS.has(ext);
  }

  async process(input: ProcessAttachmentInput): Promise<string> {
    const progress = async (message: string) => {
      await input.onProgress?.(message);
    };

    if (!this.isSupported(input.fileName)) {
      return [
        "⚠️ 지원하지 않는 파일 형식입니다.",
        "지원: HWP, HWPX, PDF, DOCX, TXT, PNG/JPG",
      ].join("\n");
    }

    if (input.data.length > config.attachmentMaxBytes) {
      const mb = Math.round(config.attachmentMaxBytes / (1024 * 1024));
      return `⚠️ 파일이 너무 큽니다. 최대 ${mb}MB까지 지원합니다.`;
    }

    const storagePath = await saveAttachmentFile(
      input.userId,
      input.fileName,
      input.data,
    );

    const attachment = await this.attachments.create({
      userId: input.userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.data.length,
      storagePath,
      telegramFileId: input.telegramFileId,
      status: "processing",
    });

    try {
      await progress("📎 텍스트 추출 중...");
      const extractStarted = Date.now();
      const kind = detectDocumentKind(input.fileName, input.mimeType);
      const text = await extractDocumentText({
        kind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        data: input.data,
      });
      console.log(`[attachment] extract ${kind} ${Date.now() - extractStarted}ms`);

      if (!text.trim()) {
        await this.attachments.update(attachment.id, input.userId, {
          status: "failed",
          errorMessage: "문서에서 텍스트를 추출하지 못했습니다.",
        });
        return "⚠️ 문서에서 텍스트를 추출하지 못했습니다.";
      }

      let analysis: DocumentAnalysis = { summary: "", keywords: [], tasks: [] };
      let createdTasks: Array<{ listIndex: number; title: string; dueAt?: Date }> = [];
      const llmSkipped = !this.analyzer.isEnabled();

      if (this.analyzer.isEnabled()) {
        await progress("🧠 업무 추출 중...");
        analysis = await this.analyzer.analyze({
          fileName: input.fileName,
          text,
          userHint: input.userHint,
        });

        if (analysis.tasks.length > 0) {
          await progress(`✅ 업무 ${analysis.tasks.length}건 등록 중...`);
        }

        const listIndexes = await this.taskService.reserveListIndexes(
          input.userId,
          analysis.tasks.length,
        );

        const created = await Promise.all(
          analysis.tasks.map(async (item, index) => {
            const dueAt = resolveExtractedDueAt(item);
            const description = [
              item.description,
              item.source_quote ? `근거: ${item.source_quote}` : "",
            ]
              .filter(Boolean)
              .join("\n");

            const task = await this.taskService.create({
              userId: input.userId,
              telegramUserId: input.telegramUserId,
              title: item.title,
              description: description || undefined,
              priority: item.priority,
              dueAt,
              attachmentId: attachment.id,
              listIndex: listIndexes[index],
              skipReminders: true,
            });

            return {
              task,
              listIndex: task.listIndex,
              title: task.title,
              dueAt: task.dueAt ?? undefined,
            };
          }),
        );

        await Promise.all(
          created
            .filter((c) => c.task.dueAt)
            .map((c) =>
              this.taskService.scheduleRemindersForTask(c.task, input.telegramUserId),
            ),
        );

        createdTasks = created.map((c) => ({
          listIndex: c.listIndex,
          title: c.title,
          dueAt: c.dueAt,
        }));
      }

      await this.attachments.update(attachment.id, input.userId, {
        status: "ready",
        extractedText: truncateForStorage(text),
        summary: analysis.summary || undefined,
        keywords: analysis.keywords,
        errorMessage: null,
      });

      const preview =
        llmSkipped && text.length > 400
          ? text.slice(0, 400) + "…"
          : undefined;

      return formatAnalysisReply({
        fileName: input.fileName,
        analysis,
        createdTasks,
        textPreview: preview,
        llmSkipped,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "첨부 분석 중 오류가 발생했습니다.";
      console.error("[attachment] process failed:", err);
      await this.attachments.update(attachment.id, input.userId, {
        status: "failed",
        errorMessage: message,
      });
      return `⚠️ ${message}`;
    }
  }

  getAbsolutePath(storagePath: string): string {
    return join(config.attachmentStorageDir, storagePath);
  }
}
