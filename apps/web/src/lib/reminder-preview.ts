import type { ExtraReminderRule } from "@/api/types";

const TIMEZONE = "Asia/Seoul";
const MATCH_TOLERANCE_MS = 60_000;

function dateKeyInTimezone(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function atHourOnDate(date: Date, hour: number): Date {
  const h = String(hour).padStart(2, "0");
  return new Date(`${dateKeyInTimezone(date)}T${h}:00:00+09:00`);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function timesMatch(a: Date, b: Date, toleranceMs = MATCH_TOLERANCE_MS): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= toleranceMs;
}

export function previewDefaultReminderTimes(
  dueAtIso: string | undefined,
  reminderHour: number,
  ddayOffsets: number[],
): Date[] {
  if (!dueAtIso) return [];

  const dueAt = new Date(dueAtIso);
  const times = new Set<number>();

  for (const offset of ddayOffsets) {
    if (offset === 0) {
      const morning = atHourOnDate(dueAt, reminderHour);
      if (morning.getTime() < dueAt.getTime()) {
        times.add(morning.getTime());
      }
      continue;
    }
    times.add(atHourOnDate(addDays(dueAt, -offset), reminderHour).getTime());
  }

  const hasExplicitTime =
    dueAt.getHours() !== 0 || dueAt.getMinutes() !== 0 || dueAt.getSeconds() !== 0;
  if (hasExplicitTime) {
    times.add(dueAt.getTime() - 60 * 60 * 1000);
  }

  return [...times].map((t) => new Date(t));
}

export function previewSingleExtraRule(
  dueAtIso: string | undefined,
  reminderHour: number,
  rule: ExtraReminderRule,
): Date[] {
  if (!dueAtIso) return [];

  const dueAt = new Date(dueAtIso);
  const times = new Set<number>();

  if (rule.daysBefore !== undefined && rule.daysBefore >= 0) {
    times.add(atHourOnDate(addDays(dueAt, -rule.daysBefore), reminderHour).getTime());
  }
  if (rule.hoursBefore !== undefined && rule.hoursBefore > 0) {
    times.add(dueAt.getTime() - rule.hoursBefore * 60 * 60 * 1000);
  }
  if (rule.minutesBefore !== undefined && rule.minutesBefore > 0) {
    times.add(dueAt.getTime() - rule.minutesBefore * 60 * 1000);
  }

  return [...times]
    .map((t) => new Date(t))
    .sort((a, b) => a.getTime() - b.getTime());
}

export function previewAllExtraRules(
  dueAtIso: string | undefined,
  reminderHour: number,
  rules: ExtraReminderRule[],
): Date[] {
  const times = new Set<number>();
  for (const rule of rules) {
    for (const fireAt of previewSingleExtraRule(dueAtIso, reminderHour, rule)) {
      times.add(fireAt.getTime());
    }
  }
  return [...times]
    .map((t) => new Date(t))
    .sort((a, b) => a.getTime() - b.getTime());
}

export function getExtraOnlyFireTimes(
  dueAtIso: string | undefined,
  reminderHour: number,
  extraRules: ExtraReminderRule[],
  options: { useDefaultReminders: boolean; ddayOffsets: number[] },
): Date[] {
  const extraTimes = previewAllExtraRules(dueAtIso, reminderHour, extraRules);
  if (!options.useDefaultReminders) return extraTimes;

  const defaultTimes = previewDefaultReminderTimes(
    dueAtIso,
    reminderHour,
    options.ddayOffsets,
  );
  return extraTimes.filter(
    (extra) => !defaultTimes.some((def) => timesMatch(extra, def)),
  );
}

export function describeExtraRuleSchedule(
  dueAtIso: string | undefined,
  reminderHour: number,
  rule: ExtraReminderRule,
  formatDateTime: (iso: string) => string,
  options: { useDefaultReminders: boolean; ddayOffsets: number[] },
): string | null {
  const hasInput =
    (rule.daysBefore !== undefined && rule.daysBefore >= 0) ||
    (rule.hoursBefore !== undefined && rule.hoursBefore > 0) ||
    (rule.minutesBefore !== undefined && rule.minutesBefore > 0);
  if (!hasInput) return null;
  if (!dueAtIso) return "마감일을 설정하면 예정 시각이 표시됩니다.";

  const extraOnlyTimes = getExtraOnlyFireTimes(dueAtIso, reminderHour, [rule], options);
  const allExtraTimes = previewSingleExtraRule(dueAtIso, reminderHour, rule);

  if (allExtraTimes.length === 0) return "예약 가능한 시각이 없습니다.";

  const now = Date.now();
  const futureExtraOnly = extraOnlyTimes.filter((t) => t.getTime() > now);

  if (futureExtraOnly.length > 0) {
    return futureExtraOnly.map((t) => formatDateTime(t.toISOString())).join(" · ");
  }

  const futureAll = allExtraTimes.filter((t) => t.getTime() > now);
  if (futureAll.length === 0) return "이미 지난 시각이라 예약되지 않습니다.";

  return "기본 알림과 같은 시각이라 별도 예약되지 않습니다.";
}
