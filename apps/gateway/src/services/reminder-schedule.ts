import { atHourOnDate } from "../utils/date.js";
import { isDateOnlyDue, shiftDaysKeepingLocalTime } from "../utils/datetime-parse.js";

export interface ExtraReminderRule {
  daysBefore?: number;
  hoursBefore?: number;
  minutesBefore?: number;
}

/** 당일(D-0) 기본 알림 시각 */
export const DDAY_TODAY_HOUR = 7;
/** 날짜만 일정일 때 D-3/D-1 등에 쓰는 기준 시각 */
const DATE_ONLY_ANCHOR_HOUR = 7;

/**
 * D-day·근접 알림 기준 시각.
 * 시작·종료가 모두 있으면 시작(startsAt), 아니면 마감(dueAt).
 */
export function reminderAnchorAt(task: {
  dueAt: Date | null | undefined;
  startsAt?: Date | null;
}): Date | null {
  if (!task.dueAt) return null;
  return task.startsAt ?? task.dueAt;
}

/** 알림 앵커를 날짜만(종일/날짜 마감)으로 다룰지 */
export function isReminderDateOnly(task: {
  dueAt: Date | null | undefined;
  startsAt?: Date | null;
  allDay?: boolean | null;
}): boolean {
  if (!task.dueAt) return false;
  if (task.allDay) return true;
  if (task.startsAt) return false;
  return isDateOnlyDue(task.dueAt);
}

/** D-N 기본 알림 시각 (N=0 → 당일 07:00, 그 외 → 앵커 시각 기준 N일 전 / 날짜만이면 07:00 기준) */
export function ddayOffsetFireTime(
  anchorAt: Date,
  offset: number,
  dateOnly = isDateOnlyDue(anchorAt),
): Date {
  if (offset === 0) {
    return atHourOnDate(anchorAt, DDAY_TODAY_HOUR);
  }
  const base = dateOnly ? atHourOnDate(anchorAt, DATE_ONLY_ANCHOR_HOUR) : anchorAt;
  return shiftDaysKeepingLocalTime(base, -offset);
}

/** 추가 알림 규칙 — 일·시간·분을 합쳐 앵커 전 한 시각으로 계산 */
export function extraRuleFireTime(
  anchorAt: Date,
  rule: ExtraReminderRule,
  dateOnly = isDateOnlyDue(anchorAt),
): Date | null {
  const days = rule.daysBefore;
  const hours = rule.hoursBefore ?? 0;
  const minutes = rule.minutesBefore ?? 0;

  const hasDays = days !== undefined && days >= 0;
  const hasSubDayTime = hours > 0 || minutes > 0;

  if (!hasDays && !hasSubDayTime) return null;

  let base: Date;
  if (hasDays && days! > 0) {
    base = ddayOffsetFireTime(anchorAt, days!, dateOnly);
    if (!hasSubDayTime) return base;
  } else if (hasDays && days === 0 && !hasSubDayTime) {
    return ddayOffsetFireTime(anchorAt, 0, dateOnly);
  } else {
    base = anchorAt;
  }

  const offsetMs = (hours * 60 * 60 + minutes * 60) * 1000;
  return offsetMs > 0 ? new Date(base.getTime() - offsetMs) : base;
}

export function buildReminderFireTimes(
  anchorAt: Date,
  options: {
    ddayOffsets: number[];
    reminderHour: number;
    extraRules?: ExtraReminderRule[];
    /** 시각 일정 1시간 전 자동 알림. 기본 true */
    includeDueProximity?: boolean;
    /** 종일/날짜만 일정이면 true (1시간 전 알림 생략, D-N은 07:00 기준) */
    dateOnly?: boolean;
  },
): Date[] {
  const now = Date.now();
  const times = new Set<number>();
  const { ddayOffsets, extraRules = [], includeDueProximity = true } = options;
  const dateOnly = options.dateOnly ?? isDateOnlyDue(anchorAt);

  for (const offset of ddayOffsets) {
    times.add(ddayOffsetFireTime(anchorAt, offset, dateOnly).getTime());
  }

  if (includeDueProximity && !dateOnly) {
    const oneHourBefore = anchorAt.getTime() - 60 * 60 * 1000;
    if (oneHourBefore > now) times.add(oneHourBefore);
  }

  for (const rule of extraRules) {
    const fireAt = extraRuleFireTime(anchorAt, rule, dateOnly);
    if (fireAt) times.add(fireAt.getTime());
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
