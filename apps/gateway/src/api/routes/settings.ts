import { Hono } from "hono";
import type { ApiEnv, UserPreferences } from "../types.js";
import { requireAppUser } from "../middleware/session.js";
import { config } from "../../config.js";
import {
  ddayOffsetsForUser,
  isDdayEnabled,
  isMorningBriefingEnabled,
} from "../../utils/notification-prefs.js";

export const settingsRoute = new Hono<ApiEnv>();

settingsRoute.use("*", requireAppUser);

const DEFAULT_BRIEFING_HOUR = 8;
const DEFAULT_BRIEFING_MINUTE = 0;

function notificationDto(prefs: UserPreferences) {
  return {
    ddayEnabled: isDdayEnabled(prefs),
    ddayOffsets: prefs.notification?.ddayOffsets ?? [3, 1, 0],
    reminderHour: prefs.notification?.reminderHour ?? config.reminderHour,
    morningBriefing: {
      enabled: isMorningBriefingEnabled(prefs),
      hour: prefs.notification?.morningBriefing?.hour ?? DEFAULT_BRIEFING_HOUR,
      minute: prefs.notification?.morningBriefing?.minute ?? DEFAULT_BRIEFING_MINUTE,
    },
    channels: {
      telegram: prefs.notification?.channels?.telegram !== false,
      kakao: prefs.notification?.channels?.kakao === true,
    },
  };
}

function notifyToggleChanges(
  app: ApiEnv["Variables"]["app"],
  userId: string,
  before: UserPreferences,
  after: UserPreferences,
): void {
  const messages: string[] = [];

  const ddayBefore = isDdayEnabled(before);
  const ddayAfter = isDdayEnabled(after);
  if (ddayBefore !== ddayAfter) {
    messages.push(ddayAfter ? "D-DAY 알림을 켰어요." : "D-DAY 알림을 껐어요.");
  }

  const briefingBefore = isMorningBriefingEnabled(before);
  const briefingAfter = isMorningBriefingEnabled(after);
  if (briefingBefore !== briefingAfter) {
    messages.push(briefingAfter ? "아침 브리핑을 켰어요." : "아침 브리핑을 껐어요.");
  }

  if (messages.length === 0) return;

  void app.notifications
    .sendTelegramToUser(userId, messages.join("\n"))
    .catch((err) => {
      console.error(`[settings] telegram notify failed for ${userId}:`, err);
    });
}

settingsRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  if (!userId) {
    return c.json({
      timezone: config.timezone,
      notification: {
        ddayEnabled: true,
        ddayOffsets: [3, 1, 0],
        reminderHour: config.reminderHour,
        morningBriefing: {
          enabled: true,
          hour: DEFAULT_BRIEFING_HOUR,
          minute: DEFAULT_BRIEFING_MINUTE,
        },
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
      ddayEnabled?: boolean;
      ddayOffsets?: number[];
      reminderHour?: number;
      morningBriefing?: {
        enabled?: boolean;
        hour?: number;
        minute?: number;
      };
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
  const nextMorningBriefing = {
    ...prefs.notification?.morningBriefing,
    ...body.notification?.morningBriefing,
  };
  if (nextMorningBriefing.hour !== undefined) {
    const hour = Number(nextMorningBriefing.hour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      return c.json({ error: "브리핑 시각(시)는 0~23 사이 정수여야 합니다." }, 400);
    }
    nextMorningBriefing.hour = hour;
  }
  if (nextMorningBriefing.minute !== undefined) {
    const minute = Number(nextMorningBriefing.minute);
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      return c.json({ error: "브리핑 시각(분)은 0~59 사이 정수여야 합니다." }, 400);
    }
    nextMorningBriefing.minute = minute;
  }
  const notification = {
    ...prefs.notification,
    ...body.notification,
    channels: nextChannels,
    morningBriefing: nextMorningBriefing,
  };

  if (notification.ddayOffsets) {
    notification.ddayOffsets = notification.ddayOffsets
      .filter((n) => Number.isInteger(n) && n >= 0)
      .sort((a, b) => b - a);
  }

  const nextPrefs: UserPreferences = {
    ...prefs,
    notification,
  };

  notifyToggleChanges(app, userId, prefs, nextPrefs);

  await app.users.updatePreferences(userId, nextPrefs);

  return c.json({
    timezone: user.timezone,
    notification: notificationDto(nextPrefs),
  });
});
