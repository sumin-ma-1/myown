import { Hono } from "hono";
import type { ExtraReminderRule, UserPreferences } from "../types.js";
import type { ApiEnv } from "../types.js";
import { apiAuth } from "../middleware/auth.js";

export const remindersRoute = new Hono<ApiEnv>();

remindersRoute.use("*", apiAuth);

remindersRoute.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  const reminderId = c.req.param("id");

  const reminder = await app.reminders.findById(reminderId);
  if (!reminder || reminder.userId !== userId) {
    return c.json({ error: "Reminder not found" }, 404);
  }
  if (reminder.status !== "pending") {
    return c.json({ error: "Only pending reminders can be cancelled" }, 400);
  }

  await app.reminderService.cancelReminder(reminderId);
  return c.json({ ok: true });
});
