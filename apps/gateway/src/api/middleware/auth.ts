import { createMiddleware } from "hono/factory";
import { config } from "../../config.js";
import type { ApiEnv } from "../types.js";

export const apiAuth = createMiddleware<ApiEnv>(async (c, next) => {
  const auth = c.req.header("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : c.req.query("token");

  if (!config.webApiToken || token !== config.webApiToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const telegramId = config.webUserTelegramId;
  if (!telegramId || Number.isNaN(telegramId)) {
    return c.json({ error: "WEB_USER_TELEGRAM_ID is not configured" }, 503);
  }

  const user = await c.var.app.users.upsert(telegramId, config.timezone);
  c.set("userId", user.id);
  await next();
});
