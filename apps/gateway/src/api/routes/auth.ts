import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ApiEnv } from "../types.js";
import { AuthService } from "../../services/auth.js";
import { config } from "../../config.js";
import { sessionMiddleware } from "../middleware/session.js";

export const authRoute = new Hono<ApiEnv>();

authRoute.get("/invite/validate", async (c) => {
  const code = c.req.query("code");
  if (!code?.trim()) {
    return c.json({ ok: false, message: "초대코드를 입력해 주세요." }, 400);
  }

  const result = await c.var.app.auth.validateInviteCode(code);
  if (!result.ok) {
    return c.json({ error: result.message }, 400);
  }

  return c.json(result);
});

authRoute.get("/google/start", async (c) => {
  const purpose = c.req.query("purpose");
  const inviteCode = c.req.query("code");

  if (purpose !== "login" && purpose !== "signup") {
    return c.json({ error: "잘못된 요청입니다." }, 400);
  }

  const result = await c.var.app.auth.beginGoogleAuth({
    purpose,
    inviteCode: inviteCode ?? undefined,
  });

  if (!result.ok) {
    return c.redirect(
      `${config.webAppUrl}/${purpose === "signup" ? "signup" : "login"}?error=${encodeURIComponent(result.message)}`,
    );
  }

  return c.redirect(result.url);
});

authRoute.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const oauthError = c.req.query("error");

  if (oauthError || !code || !state) {
    return c.redirect(
      `${config.webAppUrl}/login?error=${encodeURIComponent("Google 로그인이 취소되었습니다.")}`,
    );
  }

  try {
    const result = await c.var.app.auth.completeGoogleAuth(code, state, {
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
    });

    if (!result.ok) {
      return c.redirect(
        `${config.webAppUrl}/login?error=${encodeURIComponent(result.message)}`,
      );
    }

    setCookie(c, AuthService.sessionCookieName(), result.sessionId, {
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: c.var.app.auth.sessionMaxAgeSec(),
    });

    return c.redirect(`${config.webAppUrl}/?welcome=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google 로그인에 실패했습니다.";
    return c.redirect(`${config.webAppUrl}/login?error=${encodeURIComponent(message)}`);
  }
});

authRoute.use("*", sessionMiddleware);

authRoute.get("/me", async (c) => {
  const webAccountId = c.get("webAccountId");
  if (!webAccountId) {
    return c.json({ authenticated: false });
  }

  const account = await c.var.app.webAccounts.findById(webAccountId);
  if (!account) {
    return c.json({ authenticated: false });
  }

  const user = await c.var.app.users.findByWebAccountId(webAccountId);
  let telegramConnected = false;
  if (user) {
    const conn = await c.var.app.channelConnections.findByUserAndProvider(user.id, "telegram");
    telegramConnected = conn?.status === "connected";
  }

  return c.json({
    authenticated: true,
    account: {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: account.role,
      lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
    },
    userId: user?.id ?? null,
    telegramConnected,
  });
});

authRoute.post("/logout", async (c) => {
  const sessionId = getCookie(c, AuthService.sessionCookieName());
  if (sessionId) {
    await c.var.app.auth.logout(sessionId);
  }
  deleteCookie(c, AuthService.sessionCookieName(), { path: "/" });
  return c.json({ ok: true });
});
