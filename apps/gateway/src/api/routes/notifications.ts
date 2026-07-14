import { Hono } from "hono";
import type { ApiEnv } from "../types.js";
import { requireAppUser } from "../middleware/session.js";

export const notificationsRoute = new Hono<ApiEnv>();

notificationsRoute.use("*", requireAppUser);

function toDto(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

notificationsRoute.get("/", async (c) => {
  const userId = c.get("userId")!;
  const limit = Number(c.req.query("limit") ?? 30);
  const items = await c.get("app").userNotifications.listByUserId(userId, { limit });
  const unreadCount = await c.get("app").userNotifications.countUnread(userId);
  return c.json({ items: items.map(toDto), unreadCount });
});

notificationsRoute.post("/:id/read", async (c) => {
  const userId = c.get("userId")!;
  const id = c.req.param("id");
  const updated = await c.get("app").userNotifications.markRead(userId, id);
  if (!updated) {
    const existing = (await c.get("app").userNotifications.listByUserId(userId, { limit: 100 })).find(
      (row) => row.id === id,
    );
    if (!existing) return c.json({ error: "알림을 찾을 수 없습니다." }, 404);
    return c.json({ item: toDto(existing) });
  }
  return c.json({ item: toDto(updated) });
});

notificationsRoute.post("/read-all", async (c) => {
  const userId = c.get("userId")!;
  const marked = await c.get("app").userNotifications.markAllRead(userId);
  return c.json({ ok: true, marked });
});
