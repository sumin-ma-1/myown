import type { Context, NextFunction } from "grammy";
import { config, isUserAllowed } from "../../config.js";

export async function authMiddleware(ctx: Context, next: NextFunction) {
  const userId = ctx.from?.id;
  if (!userId) {
    return;
  }

  if (!isUserAllowed(userId)) {
    console.warn(
      `[auth] 거부됨 — 접속 ID: ${userId}, 허용 목록: ${[...config.allowedTelegramUserIds].join(", ") || "(비어 있음)"}`,
    );
    await ctx.reply(
      [
        "⛔ 이 봇은 허용된 사용자만 사용할 수 있습니다.",
        "",
        `본인 Telegram ID: ${userId}`,
        "위 숫자를 .env 의 ALLOWED_TELEGRAM_USER_IDS 에 넣고 봇을 재시작하세요.",
      ].join("\n"),
    );
    return;
  }

  await next();
}
