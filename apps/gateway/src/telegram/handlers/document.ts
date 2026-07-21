import { randomUUID } from "node:crypto";
import type { Bot } from "grammy";
import type { AppContext } from "../../context.js";
import type { BotContext } from "../bot.js";
import {
  clearCompose,
  composeContinueKeyboard,
  COMPOSE_HINT,
  setCompose,
  getCompose,
} from "../compose-session.js";
import { titleFromFileName } from "../../services/attachment.js";
import { draftFromMemo, formatDraftSummary, mergeFileIntoComposeTask } from "../helpers/compose-merge.js";

async function downloadTelegramFile(
  ctx: BotContext,
  fileId: string,
): Promise<Buffer> {
  const file = await ctx.api.getFile(fileId);
  if (!file.file_path) {
    throw new Error("Telegram 파일 경로를 가져오지 못했습니다.");
  }

  const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`파일 다운로드 실패 (${response.status})`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export function registerDocumentHandlers(bot: Bot<BotContext>, app: AppContext) {
  bot.on(["message:document", "message:photo"], async (ctx) => {
    const userId = ctx.session.userId;
    const telegramUserId = ctx.from?.id;
    if (!userId || !telegramUserId) {
      await ctx.reply("⚠️ 사용자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    try {
      await ctx.replyWithChatAction("upload_document");

      let fileName = "document";
      let mimeType: string | undefined;
      let fileId: string | undefined;
      let data: Buffer;

      if (ctx.message.document) {
        const doc = ctx.message.document;
        fileName = doc.file_name ?? `document_${doc.file_unique_id}`;
        mimeType = doc.mime_type;
        fileId = doc.file_id;
        data = await downloadTelegramFile(ctx, doc.file_id);
      } else if (ctx.message.photo?.length) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        fileName = `photo_${photo.file_unique_id}.jpg`;
        mimeType = "image/jpeg";
        fileId = photo.file_id;
        data = await downloadTelegramFile(ctx, photo.file_id);
      } else {
        return;
      }

      const userHint = ctx.message.caption?.trim() || undefined;

      const merged = await mergeFileIntoComposeTask(app, ctx, userId, {
        fileName,
        mimeType,
        data,
        telegramFileId: fileId,
      });
      if (merged.ok) {
        const compose = getCompose(ctx.session);
        await ctx.reply(
          [
            "✅ 첨부를 추가했습니다.",
            `📎 ${merged.fileName}`,
            `제목: ${merged.title}`,
            "",
            "[등록 완료]를 눌러 업무를 등록해 주세요.",
          ].join("\n"),
          {
            reply_markup: compose
              ? composeContinueKeyboard(compose.composeKey)
              : undefined,
          },
        );
        return;
      }
      if (merged.message !== "no_compose") {
        await ctx.reply(`⚠️ ${merged.message}`);
        return;
      }

      clearCompose(ctx.session);

      const status = await ctx.reply("📎 첨부 저장 중...");
      const chatId = ctx.chat?.id;

      const saved = await app.attachmentService.saveOnly({
        userId,
        fileName,
        mimeType,
        data,
        telegramFileId: fileId,
      });

      if (!saved.ok) {
        if (chatId) {
          await ctx.api.editMessageText(chatId, status.message_id, saved.message);
        } else {
          await ctx.reply(saved.message);
        }
        return;
      }

      let draft = {
        attachmentIds: [saved.attachmentId],
        title: titleFromFileName(fileName),
      };
      if (userHint) {
        draft = await draftFromMemo(app, userId, draft, userHint);
      }

      const composeKey = randomUUID();
      const lines = userHint
        ? formatDraftSummary(draft)
        : ["파일을 받았습니다.", `📎 ${saved.fileName}`, "", COMPOSE_HINT].join("\n");

      if (chatId) {
        await ctx.api.editMessageText(chatId, status.message_id, lines, {
          reply_markup: composeContinueKeyboard(composeKey),
        });
        setCompose(ctx.session, {
          composeKey,
          mode: "awaiting_text",
          anchorMessageId: status.message_id,
          draft,
        });
      } else {
        const sent = await ctx.reply(lines, {
          reply_markup: composeContinueKeyboard(composeKey),
        });
        setCompose(ctx.session, {
          composeKey,
          mode: "awaiting_text",
          anchorMessageId: sent.message_id,
          draft,
        });
      }
      await app.chatMemory.clear(userId);
    } catch (err) {
      console.error("[document] handler error:", err);
      await ctx.reply("⚠️ 첨부파일 저장 중 오류가 발생했습니다.");
    }
  });
}
