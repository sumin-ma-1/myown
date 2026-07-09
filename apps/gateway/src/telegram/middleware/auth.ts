import type { Context, NextFunction } from "grammy";
import type { AppContext } from "../../context.js";
import { isUserAllowed } from "../../config.js";
import { dashboardInlineKeyboard } from "../dashboard-keyboard.js";

function startPayload(ctx: Context): string | undefined {
  const text = ctx.message?.text;
  if (!text) return undefined;
  const match = text.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/);
  return match?.[1]?.trim();
}

/** 연동 전에도 웹 대시보드·도움말은 사용 가능 */
function isGuestAllowedCommand(ctx: Context): boolean {
  const text = ctx.message?.text?.trim();
  if (!text) return false;
  return /^\/(web|help|start)(@\w+)?(\s|$)/i.test(text);
}

async function hasConnectedTelegram(app: AppContext, telegramUserId: number): Promise<boolean> {
  const user = await app.users.findByTelegramId(telegramUserId);
  if (!user) return false;

  const conn = await app.channelConnections.findByUserAndProvider(user.id, "telegram");
  return conn?.status === "connected";
}

function guestReplyOptions() {
  const keyboard = dashboardInlineKeyboard();
  return keyboard ? { reply_markup: keyboard } : undefined;
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

    if (isGuestAllowedCommand(ctx)) {
      await next();
      return;
    }

    console.warn(`[auth] 거부됨 — Telegram ID: ${userId}`);
    await ctx.reply(
      [
        "⛔ 아직 이 봇을 사용할 수 없습니다.",
        "",
        "아래 「웹 대시보드」로 이동해 로그인 후",
        "연동 APP → Telegram → 「Telegram 연결」을 완료해 주세요.",
        "",
        "또는 /web 명령으로 대시보드 링크를 받을 수 있습니다.",
      ].join("\n"),
      guestReplyOptions(),
    );
  };
}
