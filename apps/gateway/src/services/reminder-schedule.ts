import { atHourOnDate } from "../utils/date.js";
import { isDateOnlyDue, shiftDaysKeepingLocalTime } from "../utils/datetime-parse.js";

export interface ExtraReminderRule {
  daysBefore?: number;
  hoursBefore?: number;
  minutesBefore?: number;
}

/** 당일(D-0) 기본 알림 시각 */
export const DDAY_TODAY_HOUR = 7;
/** 날짜만 마감일 때 D-3/D-1 등에 쓰는 기준 시각 */
const DATE_ONLY_ANCHOR_HOUR = 7;

/** D-N 기본 알림 시각 (N=0 → 당일 07:00, 그 외 → 마감 시각 기준 N일 전 / 날짜만 마감이면 07:00 기준) */
export function ddayOffsetFireTime(dueAt: Date, offset: number): Date {
  if (offset === 0) {
    return atHourOnDate(dueAt, DDAY_TODAY_HOUR);
  }
  const anchor = isDateOnlyDue(dueAt)
    ? atHourOnDate(dueAt, DATE_ONLY_ANCHOR_HOUR)
    : dueAt;
  return shiftDaysKeepingLocalTime(anchor, -offset);
}

export function buildReminderFireTimes(
  dueAt: Date,
  options: {
    ddayOffsets: number[];
    reminderHour: number;
    extraRules?: ExtraReminderRule[];
  },
): Date[] {
  const now = Date.now();
  const times = new Set<number>();
  const { ddayOffsets, extraRules = [] } = options;

  for (const offset of ddayOffsets) {
    times.add(ddayOffsetFireTime(dueAt, offset).getTime());
  }

  if (!isDateOnlyDue(dueAt)) {
    const oneHourBefore = dueAt.getTime() - 60 * 60 * 1000;
    if (oneHourBefore > now) times.add(oneHourBefore);
  }

  for (const rule of extraRules) {
    if (rule.daysBefore !== undefined && rule.daysBefore >= 0) {
      times.add(ddayOffsetFireTime(dueAt, rule.daysBefore).getTime());
    }
    if (rule.hoursBefore !== undefined && rule.hoursBefore > 0) {
      times.add(dueAt.getTime() - rule.hoursBefore * 60 * 60 * 1000);
    }
    if (rule.minutesBefore !== undefined && rule.minutesBefore > 0) {
      times.add(dueAt.getTime() - rule.minutesBefore * 60 * 1000);
    }
  }

  return [...times]
    .map((t) => new Date(t))
    .filter((d) => d.getTime() > now)
    .sort((a, b) => a.getTime() - b.getTime());
}

export function formatDdayOffsets(offsets: number[]): string {
  return offsets
    .sort((a, b) => b - a)
    .map((d) => (d === 0 ? "당일" : `D-${d}`))
    .join(", ");
}
