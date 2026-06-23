import { Hono } from "hono";
import type { ApiEnv, UserPreferences } from "../types.js";
import { apiAuth } from "../middleware/auth.js";
import { config } from "../../config.js";

export const settingsRoute = new Hono<ApiEnv>();

settingsRoute.use("*", apiAuth);

settingsRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const prefs = (user.preferences ?? {}) as UserPreferences;
  return c.json({
    timezone: user.timezone,
    notification: {
      ddayOffsets: prefs.notification?.ddayOffsets ?? [3, 1, 0],
      reminderHour: prefs.notification?.reminderHour ?? config.reminderHour,
    },
  });
});

settingsRoute.patch("/", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  const body = await c.req.json<{
    notification?: {
      ddayOffsets?: number[];
      reminderHour?: number;
    };
  }>();

  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const prefs = (user.preferences ?? {}) as UserPreferences;
  const notification = {
    ...prefs.notification,
    ...body.notification,
  };

  if (notification.ddayOffsets) {
    notification.ddayOffsets = notification.ddayOffsets
      .filter((n) => Number.isInteger(n) && n >= 0)
      .sort((a, b) => b - a);
  }

  await app.users.updatePreferences(userId, {
    ...prefs,
    notification,
  });

  return c.json({
    timezone: user.timezone,
    notification: {
      ddayOffsets: notification.ddayOffsets ?? [3, 1, 0],
      reminderHour: notification.reminderHour ?? config.reminderHour,
    },
  });
});
