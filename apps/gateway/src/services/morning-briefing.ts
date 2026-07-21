import type { User, UserRepository } from "@myown/database";
import type { TaskRepository } from "@myown/database";
import type { UserPreferences } from "../api/types.js";
import {
  isMorningBriefingEnabled,
} from "../utils/notification-prefs.js";
import { config } from "../config.js";
import {
  dateKeyInTimezone,
  endOfDayForTimezone,
  startOfDayForTimezone,
  timeMinutesInTimezone,
} from "../utils/date.js";
import {
  formatMorningBriefing,
  sortTasksForBriefing,
} from "../utils/morning-briefing.js";
import type { TelegramTextSender } from "./notification.js";

const DEFAULT_BRIEFING_HOUR = 8;
const DEFAULT_BRIEFING_MINUTE = 0;

/** Supports legacy `YYYY-MM-DD` and ISO datetime strings. */
function lastSentDayKey(
  lastSentDate: string | undefined,
  timezone: string,
): string | null {
  if (!lastSentDate) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(lastSentDate)) return lastSentDate;
  const parsed = new Date(lastSentDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return dateKeyInTimezone(parsed, timezone);
}

export class MorningBriefingService {
  private telegramSender: TelegramTextSender | null = null;

  constructor(
    private readonly users: UserRepository,
    private readonly tasks: TaskRepository,
  ) {}

  setTelegramSender(sender: TelegramTextSender | null): void {
    this.telegramSender = sender;
  }

  async runDueBriefings(now = new Date()): Promise<{ sent: number; skipped: number }> {
    if (!this.telegramSender) {
      return { sent: 0, skipped: 0 };
    }

    const candidates = await this.users.listWithTelegram();
    let sent = 0;
    let skipped = 0;

    for (const user of candidates) {
      const didSend = await this.trySendForUser(user, now);
      if (didSend) sent += 1;
      else skipped += 1;
    }

    return { sent, skipped };
  }

  private async trySendForUser(user: User, now: Date): Promise<boolean> {
    if (!user.telegramUserId) return false;

    const prefs = (user.preferences ?? {}) as UserPreferences;
    const briefing = prefs.notification?.morningBriefing;
    if (!isMorningBriefingEnabled(prefs)) return false;
    if (prefs.notification?.channels?.telegram === false) return false;

    const timezone = user.timezone || config.timezone;
    const todayKey = dateKeyInTimezone(now, timezone);
    if (lastSentDayKey(briefing?.lastSentDate, timezone) === todayKey) return false;

    const briefingHour = briefing?.hour ?? DEFAULT_BRIEFING_HOUR;
    const briefingMinute = briefing?.minute ?? DEFAULT_BRIEFING_MINUTE;
    const scheduledMinutes = briefingHour * 60 + briefingMinute;
    if (timeMinutesInTimezone(now, timezone) < scheduledMinutes) return false;

    const start = startOfDayForTimezone(now, timezone);
    const end = endOfDayForTimezone(now, timezone);
    const todayTasks = sortTasksForBriefing(
      await this.tasks.listDueToday(user.id, start, end),
    );
    // 오늘 마감 일정이 없으면 보내지 않음. lastSentDate는 실제 발송 시에만 남김.
    if (todayTasks.length === 0) return false;

    const text = formatMorningBriefing(todayTasks, now);

    await this.telegramSender!(user.telegramUserId, text);
    await this.markSent(user, prefs, now);
    console.log(
      `[morning-briefing] sent user=${user.id} tasks=${todayTasks.length}`,
    );
    return true;
  }

  private async markSent(
    user: User,
    prefs: UserPreferences,
    sentAt: Date,
  ): Promise<void> {
    await this.users.updatePreferences(user.id, {
      ...prefs,
      notification: {
        ...prefs.notification,
        morningBriefing: {
          ...prefs.notification?.morningBriefing,
          lastSentDate: sentAt.toISOString(),
        },
      },
    });
  }
}
