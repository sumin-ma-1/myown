import type { Context } from "hono";
import type { ApiEnv } from "../types.js";

export function requireLinkedUser(c: Context<ApiEnv>): string | Response {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Telegram 연동 후 이용할 수 있습니다." }, 503);
  }
  return userId;
}
