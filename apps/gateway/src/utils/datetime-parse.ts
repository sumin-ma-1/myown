import { config } from "../config.js";
import { addDays, startOfDayInTimezone } from "./date.js";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export function todayDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getTimePartsInTimezone(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour, minute };
}

/** 날짜만 지정된 마감(23:59)인지 */
export function isDateOnlyDue(dueAt: Date): boolean {
  const { hour, minute } = getTimePartsInTimezone(dueAt);
  return hour === 23 && minute === 59;
}

/** Asia/Seoul 달력·시각 유지하며 일수 이동 */
export function shiftDaysKeepingLocalTime(date: Date, dayDelta: number): Date {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const { hour, minute } = getTimePartsInTimezone(date);
  const noon = new Date(`${key}T12:00:00+09:00`);
  const shifted = new Date(noon.getTime() + dayDelta * 24 * 60 * 60 * 1000);
  const newKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  return new Date(`${newKey}T${h}:${m}:00+09:00`);
}

export function parseDateAndTime(date?: string, time?: string): Date | undefined {
  if (!date?.trim()) return undefined;
  if (!DATE_RE.test(date)) return undefined;

  if (!time?.trim()) {
    return new Date(`${date}T23:59:59+09:00`);
  }

  const timeMatch = time.trim().match(TIME_RE);
  if (!timeMatch) return undefined;

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) return undefined;

  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  const parsed = new Date(`${date}T${h}:${m}:00+09:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function padClock(hour: string, minute: string): string | undefined {
  const h = Number(hour);
  const m = Number(minute);
  if (h > 23 || m > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 같은 날 시작~끝 시각.
 * 예: 10:30~16:00, 10:30-16:00, 10:30부터 16:00까지
 */
export function parseClockTimeRange(
  text?: string,
): { start: string; end: string } | undefined {
  if (!text?.trim()) return undefined;
  const t = text.trim();

  const sep = t.match(
    /^(\d{1,2}):(\d{2})\s*[~\-–—〜～]\s*(\d{1,2}):(\d{2})\.?$/,
  );
  if (sep) {
    const start = padClock(sep[1]!, sep[2]!);
    const end = padClock(sep[3]!, sep[4]!);
    if (start && end && start !== end) return { start, end };
  }

  const fromTo = t.match(
    /^(\d{1,2}):(\d{2})\s*부터\s*(\d{1,2}):(\d{2})\s*까지\.?$/,
  );
  if (fromTo) {
    const start = padClock(fromTo[1]!, fromTo[2]!);
    const end = padClock(fromTo[3]!, fromTo[4]!);
    if (start && end && start !== end) return { start, end };
  }

  return undefined;
}

/** 문장 안 어디에든 있는 시작~끝 시각 */
export function findClockTimeRangeInText(
  text?: string,
): { start: string; end: string } | undefined {
  if (!text?.trim()) return undefined;
  const exact = parseClockTimeRange(text.trim());
  if (exact) return exact;

  const sep = text.match(
    /(\d{1,2}):(\d{2})\s*[~\-–—〜～]\s*(\d{1,2}):(\d{2})/,
  );
  if (sep) {
    const start = padClock(sep[1]!, sep[2]!);
    const end = padClock(sep[3]!, sep[4]!);
    if (start && end && start !== end) return { start, end };
  }

  const fromTo = text.match(
    /(\d{1,2}):(\d{2})\s*부터\s*(\d{1,2}):(\d{2})\s*까지/,
  );
  if (fromTo) {
    const start = padClock(fromTo[1]!, fromTo[2]!);
    const end = padClock(fromTo[3]!, fromTo[4]!);
    if (start && end && start !== end) return { start, end };
  }

  return undefined;
}

export function parseRemindDateTime(
  date: string | undefined,
  time: string,
): Date | undefined {
  const dateStr = date?.trim() || todayDateString();
  return parseDateAndTime(dateStr, time);
}

const RELATIVE_DAYS: Record<string, number> = {
  오늘: 0,
  내일: 1,
  모레: 2,
};

const MAX_REMIND_MINUTES = 7 * 24 * 60;

/** "5분 후", "30분 뒤" → 분 단위 */
export function parseRemindInMinutes(text: string): number | undefined {
  const match = text.match(/(\d+)\s*분\s*(?:후|뒤|뒤에)?/);
  if (!match) return undefined;

  const minutes = Number(match[1]);
  if (minutes < 1 || minutes > MAX_REMIND_MINUTES) return undefined;
  return minutes;
}

export function fireAtFromMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/** "내일 15시", "오늘 3:30", "5분 후" 등 */
export function parseRemindPhrase(text: string): Date | undefined {
  const minutes = parseRemindInMinutes(text);
  if (minutes) return fireAtFromMinutes(minutes);
  return parseKoreanRemindPhrase(text);
}

/** "내일 15시", "오늘 3:30" 등 간단한 한국어 시각 파싱 */
export function parseKoreanRemindPhrase(text: string): Date | undefined {
  const match = text.match(/(오늘|내일|모레)?\s*(\d{1,2})(?::(\d{2}))?\s*시/);
  if (!match) return undefined;

  const dayOffset = match[1] ? (RELATIVE_DAYS[match[1]] ?? 0) : 0;
  const hour = Number(match[2]);
  const minute = match[3] ? Number(match[3]) : 0;
  if (hour > 23 || minute > 59) return undefined;

  const base = addDays(startOfDayInTimezone(), dayOffset);
  const dateStr = todayDateString(base);
  return parseDateAndTime(dateStr, `${hour}:${String(minute).padStart(2, "0")}`);
}

function koreanClockHour(ampm: string | undefined, hour: number, text: string): number {
  if (ampm === "오후" && hour < 12) return hour + 12;
  if (ampm === "오전" && hour === 12) return 0;
  if (!ampm && hour >= 1 && hour <= 11 && /오후/.test(text)) return hour + 12;
  return hour;
}

/** compose 보충 메모: "오후 6시에", "내일 15시까지", "14:00" */
export function parseKoreanDueSupplement(
  text: string,
  existingDue?: Date | null,
): Date | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}))?$/);
  if (isoMatch) {
    return parseDateAndTime(isoMatch[1], isoMatch[2]);
  }

  const koreanMatch = trimmed.match(
    /^(?:(오늘|내일|모레)\s*)?(?:(오전|오후)\s*)?(\d{1,2})(?::(\d{2}))?\s*시(?:에|까지|쯤|반)?\.?$/,
  );
  if (koreanMatch) {
    const dayWord = koreanMatch[1];
    const hour = koreanClockHour(koreanMatch[2], Number(koreanMatch[3]), trimmed);
    const minute = koreanMatch[4] ? Number(koreanMatch[4]) : 0;
    if (hour > 23 || minute > 59) return undefined;

    const dayOffset = dayWord ? (RELATIVE_DAYS[dayWord] ?? 0) : 0;
    const dateStr = dayWord
      ? todayDateString(addDays(startOfDayInTimezone(), dayOffset))
      : existingDue
        ? todayDateString(existingDue)
        : todayDateString();
    return parseDateAndTime(dateStr, `${hour}:${String(minute).padStart(2, "0")}`);
  }

  const timeOnly = trimmed.match(/^(?:(오전|오후)\s*)?(\d{1,2}):(\d{2})(?:까지)?\.?$/);
  if (timeOnly) {
    const hour = koreanClockHour(timeOnly[1], Number(timeOnly[2]), trimmed);
    const minute = Number(timeOnly[3]);
    if (hour > 23 || minute > 59) return undefined;
    const dateStr = existingDue ? todayDateString(existingDue) : todayDateString();
    return parseDateAndTime(dateStr, `${hour}:${String(minute).padStart(2, "0")}`);
  }

  return parseKoreanRemindPhrase(trimmed);
}

export function looksLikeDueSupplementOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (parseClockTimeRange(trimmed)) return true;
  if (parseKoreanDueSupplement(trimmed) !== undefined) return true;
  return /^(\d{4}-\d{2}-\d{2})(\s+\d{1,2}:\d{2})?$/.test(trimmed);
}

export interface ParsedAddCommand {
  title: string;
  dueAt?: Date;
}

/** /add 제목 [YYYY-MM-DD] [HH:MM] */
export function parseAddCommand(raw: string): ParsedAddCommand {
  const withDateTime = raw.match(/^(.+?)\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})$/);
  if (withDateTime) {
    return {
      title: withDateTime[1].trim(),
      dueAt: parseDateAndTime(withDateTime[2], withDateTime[3]),
    };
  }

  const withDate = raw.match(/^(.+?)\s+(\d{4}-\d{2}-\d{2})$/);
  if (withDate) {
    return {
      title: withDate[1].trim(),
      dueAt: parseDateAndTime(withDate[2]),
    };
  }

  return { title: raw.trim() };
}

/** "10분 후 3번 알림", "10분 후에 보고 알림줘" 등 */
export function parseFlexibleRemindRequest(
  text: string,
): { listIndex?: number; minutes: number } | null {
  if (!/알림|알려|리마인/i.test(text)) return null;

  const minutesMatch = text.match(/(\d+)\s*분\s*(?:후|뒤|뒤에)?/);
  if (!minutesMatch) return null;

  const taskNumMatch = text.match(/(\d+)\s*번/);
  return {
    listIndex: taskNumMatch ? Number(taskNumMatch[1]) : undefined,
    minutes: Number(minutesMatch[1]),
  };
}
