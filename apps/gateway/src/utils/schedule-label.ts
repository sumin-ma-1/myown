import { formatDueDate, formatDueDateTime } from "./date.js";
import { getTimePartsInTimezone, isDateOnlyDue } from "./datetime-parse.js";

export interface ScheduleLabelInput {
  dueAt?: Date | string | null;
  startsAt?: Date | string | null;
  allDay?: boolean | null;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isAllDay(input: ScheduleLabelInput, dueAt: Date | null): boolean {
  if (input.allDay === true) return true;
  if (input.allDay === false) return false;
  return dueAt ? isDateOnlyDue(dueAt) : false;
}

function localDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 목록·초안·채팅용 일정 라벨 */
export function formatTaskScheduleLabel(input: ScheduleLabelInput): string | null {
  const dueAt = toDate(input.dueAt);
  if (!dueAt) return null;
  const startsAt = toDate(input.startsAt);
  const allDay = isAllDay(input, dueAt);

  if (startsAt && localDayKey(startsAt) !== localDayKey(dueAt)) {
    const startLabel =
      allDay || isDateOnlyDue(startsAt) ? formatDueDate(startsAt) : formatDueDateTime(startsAt);
    const endLabel = allDay ? formatDueDate(dueAt) : formatDueDateTime(dueAt);
    return `${startLabel} ~ ${endLabel}`;
  }

  if (allDay) {
    return `${formatDueDate(dueAt)} (종일)`;
  }

  if (startsAt && localDayKey(startsAt) === localDayKey(dueAt)) {
    const startT = clockHm(startsAt);
    const endT = clockHm(dueAt);
    if (startT && endT && startT !== endT) {
      return `${formatDueDate(dueAt)} ${startT} ~ ${endT}`;
    }
  }

  return formatDueDateTime(dueAt);
}

function clockHm(date: Date): string {
  const { hour, minute } = getTimePartsInTimezone(date);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
