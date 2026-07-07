import { Hono } from "hono";
import type { UserPreferences } from "../types.js";
import type { ApiEnv } from "../types.js";
import { addSuppressedFireTime } from "../helpers/task-reminders.js";
import { requireLinkedUser } from "../helpers/linked-user.js";
import { requireAppUser } from "../middleware/session.js";

export const remindersRoute = new Hono<ApiEnv>();

remindersRoute.use("*", requireAppUser);

remindersRoute.delete("/:id", async (c) => {
  const userId = requireLinkedUser(c);
  if (userId instanceof Response) return userId;
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

  const user = await app.users.findById(userId);
  if (user) {
    const prefs = (user.preferences ?? {}) as UserPreferences;
    await app.users.updatePreferences(
      userId,
      addSuppressedFireTime(prefs, reminder.taskId, reminder.fireAt) as Record<string, unknown>,
    );
  }

  return c.json({ ok: true });
});
