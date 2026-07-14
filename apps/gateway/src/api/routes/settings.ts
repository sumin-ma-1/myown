import { Hono } from "hono";
import type { ApiEnv, UserPreferences } from "../types.js";
import { requireAppUser } from "../middleware/session.js";
import { config } from "../../config.js";

export const settingsRoute = new Hono<ApiEnv>();

settingsRoute.use("*", requireAppUser);

function notificationDto(prefs: UserPreferences) {
  return {
    ddayOffsets: prefs.notification?.ddayOffsets ?? [3, 1, 0],
    reminderHour: prefs.notification?.reminderHour ?? config.reminderHour,
    channels: {
      telegram: prefs.notification?.channels?.telegram !== false,
      kakao: prefs.notification?.channels?.kakao === true,
    },
  };
}

settingsRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  if (!userId) {
    return c.json({
      timezone: config.timezone,
      notification: {
        ddayOffsets: [3, 1, 0],
        reminderHour: config.reminderHour,
        channels: { telegram: true, kakao: false },
      },
    });
  }

  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const prefs = (user.preferences ?? {}) as UserPreferences;
  return c.json({
    timezone: user.timezone,
    notification: notificationDto(prefs),
  });
});

settingsRoute.patch("/", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  if (!userId) {
    return c.json({ error: "Telegram 연동 후 설정을 변경할 수 있습니다." }, 400);
  }

  const body = await c.req.json<{
    notification?: {
      ddayOffsets?: number[];
      reminderHour?: number;
      channels?: {
        telegram?: boolean;
        kakao?: boolean;
      };
    };
  }>();

  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const prefs = (user.preferences ?? {}) as UserPreferences;
  const nextChannels = {
    ...prefs.notification?.channels,
    ...body.notification?.channels,
  };
  const notification = {
    ...prefs.notification,
    ...body.notification,
    channels: nextChannels,
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
    notification: notificationDto({ notification }),
  });
});
