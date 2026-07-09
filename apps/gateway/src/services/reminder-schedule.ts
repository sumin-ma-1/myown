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

/** 추가 알림 규칙 — 일·시간·분을 합쳐 마감 전 한 시각으로 계산 */
export function extraRuleFireTime(
  dueAt: Date,
  rule: ExtraReminderRule,
): Date | null {
  const days = rule.daysBefore;
  const hours = rule.hoursBefore ?? 0;
  const minutes = rule.minutesBefore ?? 0;

  const hasDays = days !== undefined && days >= 0;
  const hasSubDayTime = hours > 0 || minutes > 0;

  if (!hasDays && !hasSubDayTime) return null;

  let base: Date;
  if (hasDays && days! > 0) {
    base = ddayOffsetFireTime(dueAt, days!);
    if (!hasSubDayTime) return base;
  } else if (hasDays && days === 0 && !hasSubDayTime) {
    return ddayOffsetFireTime(dueAt, 0);
  } else {
    base = dueAt;
  }

  const offsetMs = (hours * 60 * 60 + minutes * 60) * 1000;
  return offsetMs > 0 ? new Date(base.getTime() - offsetMs) : base;
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
    const fireAt = extraRuleFireTime(dueAt, rule);
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
