import { config } from "../config.js";

function datePartsInTimezone(date: Date, timezone = config.timezone): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dateKeyInTimezone(date: Date, timezone = config.timezone): string {
  return datePartsInTimezone(date, timezone);
}

export function hourInTimezone(date: Date, timezone = config.timezone): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

export function minuteInTimezone(date: Date, timezone = config.timezone): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    minute: "2-digit",
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === "minute")?.value ?? "0");
}

export function timeMinutesInTimezone(date: Date, timezone = config.timezone): number {
  return hourInTimezone(date, timezone) * 60 + minuteInTimezone(date, timezone);
}

export function startOfDayForTimezone(date = new Date(), timezone = config.timezone): Date {
  return new Date(`${datePartsInTimezone(date, timezone)}T00:00:00+09:00`);
}

export function endOfDayForTimezone(date = new Date(), timezone = config.timezone): Date {
  const start = startOfDayForTimezone(date, timezone);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function startOfDayInTimezone(date = new Date()): Date {
  return new Date(`${datePartsInTimezone(date)}T00:00:00+09:00`);
}

export function endOfDayInTimezone(date = new Date()): Date {
  const start = startOfDayInTimezone(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function atHourOnDate(date: Date, hour: number): Date {
  const h = String(hour).padStart(2, "0");
  return new Date(`${datePartsInTimezone(date)}T${h}:00:00+09:00`);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function daysUntil(dueAt: Date): number {
  const todayStart = startOfDayInTimezone();
  const dueStart = startOfDayInTimezone(dueAt);
  return Math.round((dueStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
}

/** D-3 / D-DAY / D+1 표기 (웹 formatDday와 동일) */
export function formatDday(days: number): string {
  if (days === 0) return "D-DAY";
  if (days > 0) return `D-${days}`;
  return `D+${Math.abs(days)}`;
}

function dayOfWeekSun0(date: Date, timezone = config.timezone): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? date.getUTCDay();
}

/** LLM 시스템 프롬프트용: 사용자 타임존 기준 오늘 */
export function llmDueDateContextLines(timezone: string, now = new Date()): string[] {
  const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"] as const;
  const todayKey = dateKeyInTimezone(now, timezone);
  const todayDow = dayOfWeekSun0(now, timezone);

  return [
    `타임존: ${timezone}`,
    `오늘: ${todayKey} (${weekdayNames[todayDow]}요일)`,
    "주는 월요일 시작입니다.",
  ];
}
