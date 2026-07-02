import { Hono } from "hono";
import type { ApiEnv } from "../types.js";
import { requireAppUser } from "../middleware/session.js";
import { serializeTask } from "../serializers/task.js";
import { loadTaskAttachments } from "../helpers/load-task-attachments.js";

export const calendarRoute = new Hono<ApiEnv>();

calendarRoute.use("*", requireAppUser);

calendarRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  const fromRaw = c.req.query("from");
  const toRaw = c.req.query("to");

  if (!fromRaw || !toRaw) {
    return c.json({ error: "from and to query params are required (ISO date)" }, 400);
  }

  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return c.json({ error: "invalid date range" }, 400);
  }

  if (!userId) return c.json({ items: [] });

  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const tasks = await app.tasks.listDueInRange(userId, from, to);
  const items = await Promise.all(
    tasks.map(async (task) => {
      const attachments = await loadTaskAttachments(app, userId, task);
      const reminders = await app.reminders.listForTask(task.id);
      return serializeTask(task, user, attachments, reminders);
    }),
  );

  return c.json({ items });
});
