import type { Context, NextFunction } from "grammy";
import type { AppContext } from "../../context.js";
import { config, isUserAllowed } from "../../config.js";

function startPayload(ctx: Context): string | undefined {
  const text = ctx.message?.text;
  if (!text) return undefined;
  const match = text.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/);
  return match?.[1]?.trim();
}

async function hasConnectedTelegram(app: AppContext, telegramUserId: number): Promise<boolean> {
  const user = await app.users.findByTelegramId(telegramUserId);
  if (!user) return false;

  const conn = await app.channelConnections.findByUserAndProvider(user.id, "telegram");
  return conn?.status === "connected";
}

export function createAuthMiddleware(app: AppContext) {
  return async function authMiddleware(ctx: Context, next: NextFunction) {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }

    if (isUserAllowed(userId)) {
      await next();
      return;
    }

    const payload = startPayload(ctx);
    if (payload?.startsWith("link_")) {
      const token = payload.slice(5);
      if (await app.telegramLink.isPendingToken(token)) {
        await next();
        return;
      }
    }

    if (await hasConnectedTelegram(app, userId)) {
      await next();
      return;
    }

    console.warn(`[auth] 거부됨 — Telegram ID: ${userId}`);
    await ctx.reply(
      [
        "⛔ 아직 이 봇을 사용할 수 없습니다.",
        "",
        "웹 대시보드 → 연동 APP → Telegram에서",
        "「Telegram 연결」을 눌러 연동을 완료해 주세요.",
      ].join("\n"),
    );
  };
}
