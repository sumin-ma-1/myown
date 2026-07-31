/** Client-side RRULE helpers (mirrors gateway recurrence MVP). */

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

const WEEKDAY_TO_BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export function buildRRule(input: {
  freq: RecurrenceFreq;
  interval?: number;
  byDay?: number[];
  until?: string | null; // YYYY-MM-DD
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
  } else if (input.until?.trim()) {
    parts.push(`UNTIL=${input.until.trim().replace(/-/g, "")}`);
  }
  return parts.join(";");
}

export function parseRRule(rule: string | null | undefined): {
  freq: RecurrenceFreq;
  interval: number;
  byDay: number[];
  until: string | null;
  count: number | null;
} | null {
  if (!rule) return null;
  const map = new Map<string, string>();
  for (const part of rule.replace(/^RRULE:/i, "").split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    map.set(part.slice(0, eq).toUpperCase(), part.slice(eq + 1).trim());
  }
  const freq = map.get("FREQ")?.toUpperCase() as RecurrenceFreq | undefined;
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  const byDayMap: Record<string, number> = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
  };
  const byDay: number[] = [];
  const byDayRaw = map.get("BYDAY");
  if (byDayRaw) {
    for (const token of byDayRaw.split(",")) {
      const day = token.replace(/^-?\d+/, "").toUpperCase();
      if (byDayMap[day] !== undefined) byDay.push(byDayMap[day]!);
    }
  }
  let until: string | null = null;
  const untilRaw = map.get("UNTIL");
  if (untilRaw) {
    const m = untilRaw.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m) until = `${m[1]}-${m[2]}-${m[3]}`;
  }
  const countRaw = map.get("COUNT");
  return {
    freq,
    interval: Math.max(1, Number(map.get("INTERVAL") ?? "1") || 1),
    byDay,
    until,
    count: countRaw ? Number(countRaw) || null : null,
  };
}

export function parseOccurrenceTaskId(id: string): {
  seriesId: string;
  occurrenceKey: string | null;
} {
  const sep = id.indexOf("::");
  if (sep <= 0) return { seriesId: id, occurrenceKey: null };
  return { seriesId: id.slice(0, sep), occurrenceKey: id.slice(sep + 2) };
}
