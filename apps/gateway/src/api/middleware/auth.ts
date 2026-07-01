import { createMiddleware } from "hono/factory";
import { config } from "../../config.js";
import type { ApiEnv } from "../types.js";

export const apiAuth = createMiddleware<ApiEnv>(async (c, next) => {
  const auth = c.req.header("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : c.req.query("token");

  if (!config.webApiToken || token !== config.webApiToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.var.app.users.findFirst();
  if (user) {
    c.set("userId", user.id);
  } else {
    c.set("userId", null);
  }

  await next();
});

export function requireUserId(c: { get: (key: "userId") => string | null }): string | null {
  return c.get("userId");
}
