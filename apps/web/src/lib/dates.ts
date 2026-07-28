export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

function weekdayKoFromIso(iso: string): string {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(iso));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return WEEKDAY_KO[map[weekday] ?? new Date(iso).getUTCDay()]!;
}

/** 마감 표시: 날짜(+시각) 옆에 요일 */
export function formatDueDateTime(iso: string | null): string {
  if (!iso) return "-";
  const base = isDateOnlyDueIso(iso) ? formatDate(iso) : formatDateTime(iso);
  return `${base} (${weekdayKoFromIso(iso)})`;
}

export function formatDday(dday: number | null): string {
  if (dday === null) return "";
  if (dday === 0) return "D-DAY";
  if (dday > 0) return `D-${dday}`;
  return `D+${Math.abs(dday)}`;
}

/** 요약 카드 등: D-DAY 텍스트 색 (7일 이내만 강조) */
export function dueDateToneClass(dday: number | null): string {
  if (dday !== null && dday >= 0 && dday <= 7) {
    return "text-red-600 dark:text-red-400";
  }
  return "text-slate-500 dark:text-slate-400";
}

/** 마감 시각(HH:mm). 종일 또는 날짜만 마감(23:59)이면 null */
export function formatDueTime(iso: string | null, allDay?: boolean | null): string | null {
  if (!iso || allDay || isDateOnlyDueIso(iso)) return null;
  const { hour, minute } = getTimePartsInSeoul(new Date(iso));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** 앱 기준 타임존(Asia/Seoul)으로 마감 ISO 생성. 시각 미입력 시 날짜만 마감(23:59) */
export function toDueAtIso(date: string, time: string): string | undefined {
  if (!date.trim()) return undefined;
  const normalized = normalizeTimeInput(time);
  if (!normalized) {
    const parsed = new Date(`${date}T23:59:59+09:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  if (!isValidTimeInput(normalized)) return undefined;
  const parsed = new Date(`${date}T${normalized}:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function isDateOnlyDueIso(iso: string): boolean {
  const { hour, minute } = getTimePartsInSeoul(new Date(iso));
  return hour === 23 && minute === 59;
}

export function getTimePartsInSeoul(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? "0"),
  };
}

export function splitDueAt(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  if (isDateOnlyDueIso(iso)) return { date, time: "" };
  const { hour, minute } = getTimePartsInSeoul(d);
  return {
    date,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 로컬 날짜 YYYY-MM-DD (달력·업무 매칭용) */
export function formatLocalDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDateKeyFromIso(iso: string): string {
  return formatLocalDateKey(new Date(iso));
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** 일요일 시작 주 */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return endOfDay(d);
}

export function addWeeks(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + delta * 7);
  return d;
}

export function buildWeekDays(cursor: Date): Date[] {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** HH:mm (24시간) — Safari는 type="time" 미지원/버그가 있어 텍스트 입력용 */
const TIME_INPUT_RE = /^(\d{1,2}):(\d{2})$/;

export function normalizeTimeInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const match = t.match(TIME_INPUT_RE);
  if (!match) return t;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return t;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isValidTimeInput(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  const match = t.match(TIME_INPUT_RE);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59;
}

function localDayKeyFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** 목록·칩용: 종일 / 기간 / 시각 */
export function formatTaskScheduleLabel(input: {
  dueAt?: string | null;
  startsAt?: string | null;
  allDay?: boolean | null;
}): string | null {
  if (!input.dueAt) return null;
  const allDay = input.allDay === true || (input.allDay !== false && isDateOnlyDueIso(input.dueAt));
  const startsAt = input.startsAt;

  if (startsAt && localDayKeyFromIso(startsAt) !== localDayKeyFromIso(input.dueAt)) {
    const startLabel =
      allDay || isDateOnlyDueIso(startsAt) ? formatDate(startsAt) : formatDateTime(startsAt);
    const endLabel = allDay ? formatDate(input.dueAt) : formatDateTime(input.dueAt);
    return `${startLabel} ~ ${endLabel}`;
  }

  if (allDay) {
    return `${formatDate(input.dueAt)} (종일)`;
  }

  return formatDateTime(input.dueAt);
}

export function taskSpanDayKeys(task: {
  dueAt?: string | null;
  startsAt?: string | null;
}): string[] {
  if (!task.dueAt) return [];
  const endKey = localDateKeyFromIso(task.dueAt);
  const startKey = task.startsAt ? localDateKeyFromIso(task.startsAt) : endKey;
  if (startKey === endKey) return [endKey];

  const keys: string[] = [];
  const cursor = new Date(`${startKey}T12:00:00+09:00`);
  const end = new Date(`${endKey}T12:00:00+09:00`);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(formatLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}
