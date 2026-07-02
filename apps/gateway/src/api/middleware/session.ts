import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { config } from "../../config.js";
import type { ApiEnv } from "../types.js";
import { AuthService } from "../../services/auth.js";

export const sessionMiddleware = createMiddleware<ApiEnv>(async (c, next) => {
  const sessionId = getCookie(c, AuthService.sessionCookieName());
  c.set("webAccountId", null);
  c.set("userId", null);
  c.set("isAdmin", false);
  c.set("email", null);

  if (sessionId) {
    const resolved = await c.var.app.auth.resolveSession(sessionId);
    if (resolved) {
      c.set("webAccountId", resolved.webAccountId);
      c.set("userId", resolved.userId);
      c.set("isAdmin", resolved.isAdmin);
      c.set("email", resolved.email);
    }
  }

  await next();
});

export const requireAuth = createMiddleware<ApiEnv>(async (c, next) => {
  if (!c.get("webAccountId")) {
    return c.json({ error: "로그인이 필요합니다." }, 401);
  }
  await next();
});

export const requireAppUser = createMiddleware<ApiEnv>(async (c, next) => {
  const webAccountId = c.get("webAccountId");
  if (!webAccountId) {
    return c.json({ error: "로그인이 필요합니다." }, 401);
  }

  let userId = c.get("userId");
  if (!userId) {
    const created = await c.var.app.users.createForWebAccount(webAccountId, config.timezone);
    userId = created.id;
    c.set("userId", userId);
  }

  await next();
});

export const requireAdmin = createMiddleware<ApiEnv>(async (c, next) => {
  if (!c.get("isAdmin")) {
    return c.json({ error: "관리자 권한이 필요합니다." }, 403);
  }
  await next();
});
