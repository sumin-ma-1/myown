import type { Bot } from "grammy";
import type { AppContext } from "../../context.js";
import type { BotContext } from "../bot.js";

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
    if (!userId || !telegramUserId) return;

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

      const status = await ctx.reply("📎 문서 분석 중...");
      const userHint = ctx.message.caption?.trim() || undefined;
      const chatId = ctx.chat?.id;

      const reply = await app.attachmentService.process({
        userId,
        telegramUserId,
        fileName,
        mimeType,
        data,
        telegramFileId: fileId,
        userHint,
        onProgress: chatId
          ? async (message) => {
              try {
                await ctx.api.editMessageText(chatId, status.message_id, message);
              } catch {
                // 동일 메시지 편집 등 무시
              }
            }
          : undefined,
      });

      if (chatId) {
        await ctx.api.editMessageText(chatId, status.message_id, reply);
      } else {
        await ctx.reply(reply);
      }
    } catch (err) {
      console.error("[document] handler error:", err);
      await ctx.reply(
        "⚠️ 첨부파일 처리 중 오류가 발생했습니다.\n터미널 로그와 hwp-parser 실행 여부를 확인해 주세요.",
      );
    }
  });
}
