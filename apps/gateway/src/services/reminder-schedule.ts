import { addDays, atHourOnDate } from "../utils/date.js";
import { isDateOnlyDue } from "../utils/datetime-parse.js";

export interface ExtraReminderRule {
  daysBefore?: number;
  hoursBefore?: number;
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
  const { ddayOffsets, reminderHour, extraRules = [] } = options;

  for (const offset of ddayOffsets) {
    if (offset === 0) {
      const morning = atHourOnDate(dueAt, reminderHour);
      if (isDateOnlyDue(dueAt) || morning.getTime() < dueAt.getTime()) {
        times.add(morning.getTime());
      }
      continue;
    }
    times.add(atHourOnDate(addDays(dueAt, -offset), reminderHour).getTime());
  }

  if (!isDateOnlyDue(dueAt)) {
    const oneHourBefore = dueAt.getTime() - 60 * 60 * 1000;
    if (oneHourBefore > now) times.add(oneHourBefore);
  }

  for (const rule of extraRules) {
    if (rule.daysBefore !== undefined && rule.daysBefore >= 0) {
      times.add(atHourOnDate(addDays(dueAt, -rule.daysBefore), reminderHour).getTime());
    }
    if (rule.hoursBefore !== undefined && rule.hoursBefore > 0) {
      times.add(dueAt.getTime() - rule.hoursBefore * 60 * 60 * 1000);
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
