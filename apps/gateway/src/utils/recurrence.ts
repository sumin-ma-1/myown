/**
 * MVP RRULE expander: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY + INTERVAL + BYDAY + UNTIL|COUNT.
 * DTSTART = startsAt ?? dueAt (Asia/Seoul).
 */

export type RRuleFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface ParsedRRule {
  freq: RRuleFreq;
  interval: number;
  byDay: number[]; // 0=Sun … 6=Sat
  until?: Date;
  count?: number;
}

export interface RecurrenceSeriesInput {
  recurrenceRule: string;
  recurrenceUntil?: Date | null;
  recurrenceCount?: number | null;
  startsAt?: Date | null;
  dueAt: Date;
  allDay?: boolean;
}

export interface OccurrenceInstance {
  occurrenceStartsAt: Date;
  startsAt: Date | null;
  dueAt: Date;
}

const BYDAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const WEEKDAY_TO_BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export function parseRRule(rule: string): ParsedRRule | null {
  const parts = rule
    .replace(/^RRULE:/i, "")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const map = new Map<string, string>();
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    map.set(part.slice(0, eq).toUpperCase(), part.slice(eq + 1).trim());
  }

  const freqRaw = map.get("FREQ")?.toUpperCase();
  if (
    freqRaw !== "DAILY" &&
    freqRaw !== "WEEKLY" &&
    freqRaw !== "MONTHLY" &&
    freqRaw !== "YEARLY"
  ) {
    return null;
  }

  const interval = Math.max(1, Number(map.get("INTERVAL") ?? "1") || 1);
  const byDay: number[] = [];
  const byDayRaw = map.get("BYDAY");
  if (byDayRaw) {
    for (const token of byDayRaw.split(",")) {
      const day = token.replace(/^-?\d+/, "").toUpperCase();
      const idx = BYDAY_MAP[day];
      if (idx !== undefined) byDay.push(idx);
    }
  }

  let until: Date | undefined;
  const untilRaw = map.get("UNTIL");
  if (untilRaw) {
    const m = untilRaw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
    if (m) {
      const hh = m[4] ?? "23";
      const mm = m[5] ?? "59";
      const ss = m[6] ?? "59";
      until = new Date(`${m[1]}-${m[2]}-${m[3]}T${hh}:${mm}:${ss}+09:00`);
    }
  }

  const countRaw = map.get("COUNT");
  const count = countRaw ? Math.max(1, Number(countRaw) || 0) || undefined : undefined;

  return { freq: freqRaw, interval, byDay, until, count };
}

export function buildRRule(input: {
  freq: RRuleFreq;
  interval?: number;
  byDay?: number[];
  until?: Date | null;
  count?: number | null;
}): string {
  const parts = [`FREQ=${input.freq}`, `INTERVAL=${Math.max(1, input.interval ?? 1)}`];
  if (input.freq === "WEEKLY" && input.byDay && input.byDay.length > 0) {
    const days = [...new Set(input.byDay)]
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_TO_BYDAY[d]!)
      .join(",");
    parts.push(`BYDAY=${days}`);
  }
  if (input.count && input.count > 0) {
    parts.push(`COUNT=${input.count}`);
  } else if (input.until) {
    const key = localDayKey(input.until);
    parts.push(`UNTIL=${key.replace(/-/g, "")}`);
  }
  return parts.join(";");
}

export function formatRecurrenceLabel(rule: string | null | undefined): string | null {
  if (!rule) return null;
  const parsed = parseRRule(rule);
  if (!parsed) return null;
  const interval = parsed.interval;
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  if (parsed.freq === "DAILY") {
    return interval === 1 ? "매일" : `${interval}일마다`;
  }
  if (parsed.freq === "WEEKLY") {
    const base = interval === 1 ? "매주" : `${interval}주마다`;
    // BYDAY 없으면 앵커(마감/시작) 요일 기준으로 반복 — 라벨은 주기만
    if (parsed.byDay.length === 0) return base;
    const days = parsed.byDay.map((d) => dayNames[d]).join(",");
    return `${base} ${days}`;
  }
  if (parsed.freq === "MONTHLY") {
    return interval === 1 ? "매월" : `${interval}개월마다`;
  }
  return interval === 1 ? "매년" : `${interval}년마다`;
}

function localDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getLocalParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour") === "24" ? "0" : get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

function atLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): Date {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");
  const s = String(second).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${h}:${mi}:${s}+09:00`);
}

function addCalendarDays(date: Date, days: number): Date {
  const p = getLocalParts(date);
  const noon = atLocal(p.year, p.month, p.day, 12, 0, 0);
  const shifted = new Date(noon.getTime() + days * 86_400_000);
  const sp = getLocalParts(shifted);
  return atLocal(sp.year, sp.month, sp.day, p.hour, p.minute, p.second);
}

function addMonthsKeepingDom(date: Date, months: number): Date {
  const p = getLocalParts(date);
  const total = p.year * 12 + (p.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(p.day, dim);
  return atLocal(year, month, day, p.hour, p.minute, p.second);
}

function daysBetweenLocal(a: Date, b: Date): number {
  const ap = getLocalParts(a);
  const bp = getLocalParts(b);
  const aNoon = atLocal(ap.year, ap.month, ap.day, 12, 0).getTime();
  const bNoon = atLocal(bp.year, bp.month, bp.day, 12, 0).getTime();
  return Math.round((bNoon - aNoon) / 86_400_000);
}

function overlapsWindow(
  occStart: Date,
  occDue: Date,
  hasStart: boolean,
  from: Date,
  to: Date,
): boolean {
  const rangeStart = hasStart ? occStart : occDue;
  return occDue.getTime() >= from.getTime() && rangeStart.getTime() <= to.getTime();
}

export function expandRecurrence(
  series: RecurrenceSeriesInput,
  from: Date,
  to: Date,
): OccurrenceInstance[] {
  const parsed = parseRRule(series.recurrenceRule);
  if (!parsed || !series.dueAt) return [];

  const anchorStart = series.startsAt ?? series.dueAt;
  const durationMs = Math.max(0, series.dueAt.getTime() - anchorStart.getTime());
  const hasStart = Boolean(series.startsAt);
  const until = series.recurrenceUntil ?? parsed.until ?? null;
  const maxCount = series.recurrenceCount ?? parsed.count ?? null;

  const ap = getLocalParts(anchorStart);
  const out: OccurrenceInstance[] = [];
  let emitted = 0;
  let guard = 0;

  const pushIf = (occStart: Date) => {
    if (until && occStart.getTime() > until.getTime()) return false;
    if (maxCount !== null && emitted >= maxCount) return false;
    const occDue = new Date(occStart.getTime() + durationMs);
    emitted++;
    if (overlapsWindow(occStart, occDue, hasStart, from, to)) {
      out.push({
        occurrenceStartsAt: occStart,
        startsAt: hasStart ? occStart : null,
        dueAt: occDue,
      });
    }
    return maxCount === null || emitted < maxCount;
  };

  if (parsed.freq === "DAILY") {
    let cursor = atLocal(ap.year, ap.month, ap.day, ap.hour, ap.minute, ap.second);
    while (guard++ < 20_000) {
      if (until && cursor.getTime() > until.getTime()) break;
      if (maxCount !== null && emitted >= maxCount) break;
      const occDue = new Date(cursor.getTime() + durationMs);
      if ((hasStart ? cursor : occDue).getTime() > to.getTime() && emitted > 0) {
        // may still need COUNT completions before window — keep going only if before to
      }
      if (!pushIf(cursor)) break;
      if ((hasStart ? cursor : occDue).getTime() > to.getTime() && (!until || cursor > until)) {
        // enough past window
        if (maxCount === null) break;
      }
      if ((hasStart ? cursor : new Date(cursor.getTime() + durationMs)).getTime() > to.getTime()) {
        if (maxCount === null) break;
      }
      cursor = addCalendarDays(cursor, parsed.interval);
      if (cursor.getTime() > to.getTime() + 86_400_000 * 2 && maxCount === null) break;
    }
  } else if (parsed.freq === "WEEKLY") {
    const byDay =
      parsed.byDay.length > 0 ? parsed.byDay : [getLocalParts(anchorStart).weekday];
    // Walk day-by-day from anchor; include if weekday in byDay and week offset % interval === 0
    let dayCursor = atLocal(ap.year, ap.month, ap.day, ap.hour, ap.minute, ap.second);
    while (guard++ < 20_000) {
      if (until && dayCursor.getTime() > until.getTime()) break;
      if (maxCount !== null && emitted >= maxCount) break;
      const wd = getLocalParts(dayCursor).weekday;
      const weekIndex = Math.floor(daysBetweenLocal(anchorStart, dayCursor) / 7);
      if (byDay.includes(wd) && weekIndex % parsed.interval === 0) {
        if (!pushIf(dayCursor)) break;
      }
      if (dayCursor.getTime() > to.getTime() + 86_400_000 * 8 && maxCount === null) break;
      dayCursor = addCalendarDays(dayCursor, 1);
    }
  } else if (parsed.freq === "MONTHLY") {
    let cursor = atLocal(ap.year, ap.month, ap.day, ap.hour, ap.minute, ap.second);
    while (guard++ < 5_000) {
      if (until && cursor.getTime() > until.getTime()) break;
      if (maxCount !== null && emitted >= maxCount) break;
      if (!pushIf(cursor)) break;
      if (cursor.getTime() > to.getTime() && maxCount === null) break;
      cursor = addMonthsKeepingDom(cursor, parsed.interval);
    }
  } else {
    let cursor = atLocal(ap.year, ap.month, ap.day, ap.hour, ap.minute, ap.second);
    while (guard++ < 2_000) {
      if (until && cursor.getTime() > until.getTime()) break;
      if (maxCount !== null && emitted >= maxCount) break;
      if (!pushIf(cursor)) break;
      if (cursor.getTime() > to.getTime() && maxCount === null) break;
      cursor = addMonthsKeepingDom(cursor, parsed.interval * 12);
    }
  }

  return out;
}

export function occurrenceInstanceId(taskId: string, occurrenceStartsAt: Date): string {
  return `${taskId}::${occurrenceStartsAt.toISOString()}`;
}

export function parseOccurrenceInstanceId(
  id: string,
): { taskId: string; occurrenceStartsAt: Date } | null {
  const sep = id.indexOf("::");
  if (sep <= 0) return null;
  const taskId = id.slice(0, sep);
  const iso = id.slice(sep + 2);
  const d = new Date(iso);
  if (!taskId || Number.isNaN(d.getTime())) return null;
  return { taskId, occurrenceStartsAt: d };
}
