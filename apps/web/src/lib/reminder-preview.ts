import type { ExtraReminderRule } from "@/api/types";

const TIMEZONE = "Asia/Seoul";
const MATCH_TOLERANCE_MS = 60_000;
export const DDAY_TODAY_HOUR = 7;
const DATE_ONLY_ANCHOR_HOUR = 7;

function dateKeyInTimezone(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTimePartsInTimezone(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? "0"),
  };
}

function shiftDaysKeepingLocalTime(date: Date, dayDelta: number): Date {
  const key = dateKeyInTimezone(date);
  const { hour, minute } = getTimePartsInTimezone(date);
  const noon = new Date(`${key}T12:00:00+09:00`);
  const shifted = new Date(noon.getTime() + dayDelta * 24 * 60 * 60 * 1000);
  const newKey = dateKeyInTimezone(shifted);
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  return new Date(`${newKey}T${h}:${m}:00+09:00`);
}

function atHourOnDate(date: Date, hour: number): Date {
  const h = String(hour).padStart(2, "0");
  return new Date(`${dateKeyInTimezone(date)}T${h}:00:00+09:00`);
}

function isDateOnlyDue(dueAt: Date): boolean {
  const { hour, minute } = getTimePartsInTimezone(dueAt);
  return hour === 23 && minute === 59;
}

function ddayOffsetFireTime(dueAt: Date, offset: number): Date {
  if (offset === 0) {
    return atHourOnDate(dueAt, DDAY_TODAY_HOUR);
  }
  const anchor = isDateOnlyDue(dueAt)
    ? atHourOnDate(dueAt, DATE_ONLY_ANCHOR_HOUR)
    : dueAt;
  return shiftDaysKeepingLocalTime(anchor, -offset);
}

export function timesMatch(a: Date, b: Date, toleranceMs = MATCH_TOLERANCE_MS): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= toleranceMs;
}

export function previewDefaultReminderTimes(
  dueAtIso: string | undefined,
  _reminderHour: number,
  ddayOffsets: number[],
): Date[] {
  if (!dueAtIso) return [];

  const dueAt = new Date(dueAtIso);
  const times = new Set<number>();

  for (const offset of ddayOffsets) {
    times.add(ddayOffsetFireTime(dueAt, offset).getTime());
  }

  if (!isDateOnlyDue(dueAt)) {
    times.add(dueAt.getTime() - 60 * 60 * 1000);
  }

  return [...times].map((t) => new Date(t));
}

export function previewSingleExtraRule(
  dueAtIso: string | undefined,
  _reminderHour: number,
  rule: ExtraReminderRule,
): Date[] {
  if (!dueAtIso) return [];

  const dueAt = new Date(dueAtIso);
  const times = new Set<number>();

  if (rule.daysBefore !== undefined && rule.daysBefore >= 0) {
    times.add(ddayOffsetFireTime(dueAt, rule.daysBefore).getTime());
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

  const allExtraTimes = previewSingleExtraRule(dueAtIso, reminderHour, rule);
  if (allExtraTimes.length === 0) return "예약 가능한 시각이 없습니다.";

  const now = Date.now();
  const defaultTimes = options.useDefaultReminders
    ? previewDefaultReminderTimes(dueAtIso, reminderHour, options.ddayOffsets)
    : [];

  const bookable = allExtraTimes.filter(
    (t) => t.getTime() > now && !defaultTimes.some((d) => timesMatch(t, d)),
  );
  if (bookable.length > 0) {
    return bookable.map((t) => formatDateTime(t.toISOString())).join(" · ");
  }

  const futureDefaultDupes = allExtraTimes.filter(
    (t) => t.getTime() > now && defaultTimes.some((d) => timesMatch(t, d)),
  );
  if (futureDefaultDupes.length > 0) {
    const times = futureDefaultDupes.map((t) => formatDateTime(t.toISOString())).join(" · ");
    const dLabel =
      rule.daysBefore === 0 ? "당일" : rule.daysBefore !== undefined ? `D-${rule.daysBefore}` : "기본";
    return `${times} - 기본 알림(${dLabel})과 같은 시각이라 별도 예약되지 않습니다.`;
  }

  const pastTimes = allExtraTimes.filter((t) => t.getTime() <= now);
  if (pastTimes.length > 0) {
    const times = pastTimes.map((t) => formatDateTime(t.toISOString())).join(" · ");
    const matchesDefault = pastTimes.some((t) => defaultTimes.some((d) => timesMatch(t, d)));
    if (matchesDefault && rule.daysBefore !== undefined) {
      const dLabel = rule.daysBefore === 0 ? "당일" : `D-${rule.daysBefore}`;
      return `${times} - 기본 ${dLabel} 알림 시각이며, 이미 지나 예약되지 않습니다.`;
    }
    return `${times} - 이미 지난 시각이라 예약되지 않습니다.`;
  }

  return "예약 가능한 시각이 없습니다.";
}
