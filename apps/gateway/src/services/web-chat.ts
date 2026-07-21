import type { AppContext } from "../context.js";
import type { ComposeDraft } from "../telegram/compose-session.js";
import { buildComposeRegistrationSummary } from "../telegram/helpers/compose-finalize.js";
import {
  discardActiveTask,
  draftFromMemo,
  formatDraftSummary,
} from "../telegram/helpers/compose-merge.js";
import { titleFromFileName } from "./attachment.js";
import { WebComposeStore, type WebComposeState } from "./web-compose-store.js";

export interface ComposeDraftDto {
  mode: WebComposeState["mode"];
  title: string;
  description?: string | null;
  priority?: ComposeDraft["priority"];
  dueAt?: string | null;
  attachmentIds: string[];
  attachments: { id: string; fileName: string }[];
}

async function resolveTelegramId(app: AppContext, userId: string): Promise<number | null> {
  const user = await app.users.findById(userId);
  return user?.telegramUserId ?? null;
}

async function toComposeDto(
  app: AppContext,
  userId: string,
  state: WebComposeState,
): Promise<ComposeDraftDto> {
  const attachments: { id: string; fileName: string }[] = [];
  for (const id of state.draft.attachmentIds) {
    const row = await app.attachments.findById(userId, id);
    if (row && row.userId === userId) {
      attachments.push({ id: row.id, fileName: row.fileName });
    }
  }

  return {
    mode: state.mode,
    title: state.draft.title,
    description: state.draft.description,
    priority: state.draft.priority,
    dueAt: state.draft.dueAt?.toISOString() ?? null,
    attachmentIds: state.draft.attachmentIds,
    attachments,
  };
}

export class WebChatService {
  private readonly store: WebComposeStore;

  constructor(private readonly app: AppContext) {
    this.store = new WebComposeStore(app.redis);
  }

  async getCompose(userId: string): Promise<ComposeDraftDto | null> {
    const state = await this.store.get(userId);
    if (!state) return null;
    return toComposeDto(this.app, userId, state);
  }

  async handleText(
    userId: string,
    text: string,
  ): Promise<{ reply: string; compose: ComposeDraftDto | null }> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { reply: "메시지를 입력해 주세요.", compose: await this.getCompose(userId) };
    }

    const existing = await this.store.get(userId);
    if (existing) {
      const draft = await draftFromMemo(this.app, existing.draft, trimmed);
      const state: WebComposeState = { ...existing, draft };
      await this.store.set(userId, state);
      return {
        reply: formatDraftSummary(draft),
        compose: await toComposeDto(this.app, userId, state),
      };
    }

    const telegramUserId = await resolveTelegramId(this.app, userId);
    const activeBefore = await this.app.tasks.listActive(userId);
    const beforeIds = new Set(activeBefore.map((t) => t.id));
    const recentTurns = await this.app.chatMemory.getTurns(userId);

    const reply = await this.app.agent.handleMessage({
      userId,
      telegramUserId: telegramUserId ?? 0,
      text: trimmed,
      activeTasks: activeBefore,
      recentTurns,
    });

    const activeAfter = await this.app.taskService.getActiveTasks(userId);
    const created = activeAfter.filter((t) => !beforeIds.has(t.id));

    if (created.length === 1) {
      const task = created[0]!;
      const attachments = await this.app.taskAttachments.listForTask(
        userId,
        task.id,
        task.attachmentId,
      );
      if (attachments.length === 0) {
        await discardActiveTask(this.app, userId, task.id);
        const state: WebComposeState = {
          mode: "awaiting_attachment",
          draft: {
            attachmentIds: [],
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueAt: task.dueAt,
          },
        };
        await this.store.set(userId, state);
        await this.app.chatMemory.clear(userId);
        return {
          reply: formatDraftSummary(state.draft),
          compose: await toComposeDto(this.app, userId, state),
        };
      }
    }

    if (trimmed.startsWith("/")) {
      await this.app.chatMemory.clear(userId);
    } else {
      await this.app.chatMemory.appendTurns(userId, [
        { role: "user", text: trimmed },
        { role: "assistant", text: reply },
      ]);
    }
    return { reply, compose: await this.getCompose(userId) };
  }

  async addFile(
    userId: string,
    file: { fileName: string; mimeType?: string; data: Buffer },
    caption?: string,
  ): Promise<{ reply: string; compose: ComposeDraftDto | null }> {
    const saved = await this.app.attachmentService.saveOnly({
      userId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      data: file.data,
    });
    if (!saved.ok) {
      return { reply: saved.message, compose: await this.getCompose(userId) };
    }

    const existing = await this.store.get(userId);
    if (existing) {
      const draft: ComposeDraft = {
        ...existing.draft,
        attachmentIds: [...existing.draft.attachmentIds, saved.attachmentId],
      };
      const state: WebComposeState = { ...existing, draft };
      await this.store.set(userId, state);
      return {
        reply: [
          "✅ 첨부를 추가했습니다.",
          `📎 ${saved.fileName}`,
          "",
          "메모를 추가하거나 [등록 완료]를 눌러 주세요.",
        ].join("\n"),
        compose: await toComposeDto(this.app, userId, state),
      };
    }

    let draft: ComposeDraft = {
      attachmentIds: [saved.attachmentId],
      title: titleFromFileName(file.fileName),
    };
    if (caption?.trim()) {
      draft = await draftFromMemo(this.app, draft, caption.trim());
    }

    const state: WebComposeState = {
      mode: caption?.trim() ? "awaiting_attachment" : "awaiting_text",
      draft,
    };
    await this.store.set(userId, state);

    await this.app.chatMemory.clear(userId);

    const reply = caption?.trim()
      ? formatDraftSummary(draft)
      : [
          "파일을 받았습니다.",
          `📎 ${saved.fileName}`,
          "",
          "메모를 입력하거나 파일을 더 첨부한 뒤 [등록 완료]를 눌러 주세요.",
        ].join("\n");

    return { reply, compose: await toComposeDto(this.app, userId, state) };
  }

  async addMemo(
    userId: string,
    text: string,
  ): Promise<{ reply: string; compose: ComposeDraftDto | null }> {
    const existing = await this.store.get(userId);
    if (!existing) {
      return { reply: "등록 중인 업무가 없습니다. 메시지를 보내거나 파일을 첨부해 주세요.", compose: null };
    }

    const draft = await draftFromMemo(this.app, existing.draft, text.trim());
    const state: WebComposeState = { ...existing, draft };
    await this.store.set(userId, state);
    return {
      reply: formatDraftSummary(draft),
      compose: await toComposeDto(this.app, userId, state),
    };
  }

  async register(userId: string): Promise<{ reply: string; compose: null }> {
    const existing = await this.store.get(userId);
    if (!existing) {
      return { reply: "등록할 업무 초안이 없습니다.", compose: null };
    }

    const telegramUserId = await resolveTelegramId(this.app, userId);
    try {
      const task = await this.app.attachmentService.registerFromDraft({
        userId,
        telegramUserId,
        draft: existing.draft,
      });
      await this.store.clear(userId);
      await this.app.chatMemory.clear(userId);
      const summary = await buildComposeRegistrationSummary(this.app, userId, task);
      return { reply: summary, compose: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "업무 등록에 실패했습니다.";
      return { reply: `⚠️ ${message}`, compose: null };
    }
  }

  async cancel(userId: string): Promise<{ reply: string; compose: null }> {
    const existing = await this.store.get(userId);
    if (!existing) {
      return { reply: "취소할 등록 초안이 없습니다.", compose: null };
    }

    for (const attachmentId of existing.draft.attachmentIds) {
      await this.app.attachmentService.deleteDraftAttachment(userId, attachmentId);
    }
    await this.store.clear(userId);
    await this.app.chatMemory.clear(userId);
    return { reply: "등록을 취소했습니다.", compose: null };
  }
}
