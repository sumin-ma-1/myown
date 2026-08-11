import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TaskDto } from "@/api/types";
import { ScrollFadeArea } from "@/components/ui/ScrollFadeArea";
import {
  dateFromLocalKey,
  formatDueTime,
  formatLocalDateKey,
  formatTaskScheduleLabel,
  getTimePartsInSeoul,
  localDateKeyFromIso,
} from "@/lib/dates";
import { priorityCalendarChipClass, priorityLabel } from "@/lib/priority";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_PX = 48;
const GRID_HEIGHT = HOURS.length * HOUR_PX;
const MINUTES_IN_DAY = 24 * 60;
const DUE_ONLY_BLOCK_MIN = 45;
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

type TimedBlock = {
  task: TaskDto;
  startMin: number;
  endMin: number;
  dueOnly: boolean;
  stack: number;
};

function isAllDayTask(task: TaskDto): boolean {
  return task.allDay || !formatDueTime(task.dueAt, task.allDay);
}

function minutesOnDay(iso: string, dayKey: string): number | null {
  if (localDateKeyFromIso(iso) !== dayKey) return null;
  const { hour, minute } = getTimePartsInSeoul(new Date(iso));
  return hour * 60 + minute;
}

function timedRangeForDay(
  task: TaskDto,
  dayKey: string,
): { startMin: number; endMin: number; dueOnly: boolean } | null {
  if (!task.dueAt || isAllDayTask(task)) return null;

  const startKey = task.startsAt ? localDateKeyFromIso(task.startsAt) : null;
  const dueKey = localDateKeyFromIso(task.dueAt);
  const dueMin = minutesOnDay(task.dueAt, dayKey);

  if (!task.startsAt) {
    if (dueMin === null) return null;
    return {
      startMin: Math.max(0, dueMin - DUE_ONLY_BLOCK_MIN),
      endMin: Math.max(dueMin, Math.max(0, dueMin - DUE_ONLY_BLOCK_MIN) + 20),
      dueOnly: true,
    };
  }

  const startMin =
    startKey === dayKey
      ? (minutesOnDay(task.startsAt, dayKey) ?? 0)
      : startKey && startKey < dayKey
        ? 0
        : null;
  if (startMin === null) return null;

  let endMin: number;
  if (dueKey === dayKey) {
    endMin = dueMin ?? MINUTES_IN_DAY;
  } else if (dueKey > dayKey) {
    endMin = MINUTES_IN_DAY;
  } else {
    return null;
  }

  if (endMin <= startMin) {
    endMin = Math.min(MINUTES_IN_DAY, startMin + DUE_ONLY_BLOCK_MIN);
  }

  return { startMin, endMin, dueOnly: false };
}

const OVERLAP_INSET_PX = 10;

function stackOverlaps(
  items: Array<{ task: TaskDto; startMin: number; endMin: number; dueOnly: boolean }>,
): TimedBlock[] {
  const sorted = [...items].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin,
  );
  return sorted.map((item, index) => {
    const stack = sorted
      .slice(0, index)
      .filter((other) => other.endMin > item.startMin && other.startMin < item.endMin)
      .length;
    return { ...item, stack };
  });
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function snapTimeFromOffset(hour: number, offsetY: number, hourPx: number): string {
  const minute = offsetY > hourPx / 2 ? 30 : 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function DayTimeline({
  dayKey,
  tasks,
  onTaskClick,
  onSlotClick,
  hideHeader = false,
}: {
  dayKey: string;
  tasks: TaskDto[];
  onTaskClick?: (task: TaskDto) => void;
  onSlotClick?: (dayKey: string, dueTime: string) => void;
  hideHeader?: boolean;
}) {
  const day = dateFromLocalKey(dayKey);
  const weekdayLabel = `${WEEKDAY_KO[day.getDay()]}요일`;
  const monthLabel = `${day.getMonth() + 1}월`;
  const isToday = dayKey === formatLocalDateKey(new Date());

  const { allDayTasks, timedBlocks } = useMemo(() => {
    const allDay: TaskDto[] = [];
    const timed: Array<{ task: TaskDto; startMin: number; endMin: number; dueOnly: boolean }> = [];
    for (const task of tasks) {
      const range = timedRangeForDay(task, dayKey);
      if (range) timed.push({ task, ...range });
      else allDay.push(task);
    }
    return { allDayTasks: allDay, timedBlocks: stackOverlaps(timed) };
  }, [tasks, dayKey]);

  const [nowMin, setNowMin] = useState(() => currentMinutes());
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isToday) return;
    const tick = () => setNowMin(currentMinutes());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [isToday]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const targetMin = isToday
      ? currentMinutes()
      : timedBlocks.reduce(
          (earliest, block) => Math.min(earliest, block.startMin),
          MINUTES_IN_DAY,
        );
    if (targetMin >= MINUTES_IN_DAY) {
      el.scrollTop = 0;
      return;
    }

    const top = (targetMin / MINUTES_IN_DAY) * GRID_HEIGHT - el.clientHeight / 3;
    el.scrollTop = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, top));
  }, [dayKey, hideHeader, isToday, timedBlocks]);

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col"
      onClick={(event) => event.stopPropagation()}
    >
      {!hideHeader && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <p className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dbe9ff] text-lg font-semibold tabular-nums text-slate-800 dark:bg-[#dbe9ff]/25 dark:text-slate-100">
              {day.getDate()}
            </p>
            <p className="min-w-0 text-xs font-medium text-slate-600 dark:text-slate-300">
              {monthLabel} · {weekdayLabel}
              {isToday ? " · 오늘" : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {tasks.length}건
          </span>
        </div>
      )}

      {allDayTasks.length > 0 && (
        <ul className="mb-3 shrink-0 space-y-1">
          {allDayTasks.map((task) => (
            <li key={task.id}>
              <TimelineChip task={task} onClick={onTaskClick} />
            </li>
          ))}
        </ul>
      )}

      <ScrollFadeArea
        hideScrollbar
        viewportRef={viewportRef}
        wrapperClassName="h-full min-h-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700"
        className={hideHeader ? "absolute inset-0" : "h-full max-h-[42rem] lg:max-h-none"}
      >
        <div className="relative" style={{ height: GRID_HEIGHT }}>
          {HOURS.map((hour) => (
            <button
              key={hour}
              type="button"
              className="absolute right-0 left-0 flex border-t border-slate-200/80 text-left hover:bg-slate-50/80 dark:border-white/[0.08] dark:hover:bg-white/[0.03]"
              style={{ top: hour * HOUR_PX, height: HOUR_PX }}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                onSlotClick?.(dayKey, snapTimeFromOffset(hour, event.clientY - rect.top, HOUR_PX));
              }}
            >
              <span className="w-12 shrink-0 pt-0.5 text-center text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                {formatHourLabel(hour)}
              </span>
            </button>
          ))}

          <TimelineBlocks
            timedBlocks={timedBlocks}
            isToday={isToday}
            nowMin={nowMin}
            onTaskClick={onTaskClick}
          />
        </div>
      </ScrollFadeArea>
    </div>
  );
}

function TimelineBlocks({
  timedBlocks,
  isToday,
  nowMin,
  onTaskClick,
}: {
  timedBlocks: TimedBlock[];
  isToday: boolean;
  nowMin: number;
  onTaskClick?: (task: TaskDto) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-10 right-1 sm:left-12">
      {timedBlocks.map((block) => {
        const top = (block.startMin / MINUTES_IN_DAY) * 100;
        const height = Math.max(
          ((block.endMin - block.startMin) / MINUTES_IN_DAY) * 100,
          (20 / MINUTES_IN_DAY) * 100,
        );
        const inset = block.stack * OVERLAP_INSET_PX;
        const isCompleted = block.task.status === "completed";
        const chipClass = isCompleted
          ? "bg-slate-100/90 text-slate-500 hover:bg-slate-200/90 dark:bg-slate-700/70 dark:text-slate-400 dark:hover:bg-slate-700/85"
          : priorityCalendarChipClass(block.task.priority);
        const startLabel = formatMinutes(block.startMin);
        const endLabel = formatMinutes(block.endMin);
        const timeLabel = block.dueOnly ? endLabel : `${startLabel}–${endLabel}`;
        const scheduleLabel = formatTaskScheduleLabel(block.task);

        return (
          <button
            key={block.task.id}
            type="button"
            className={`pointer-events-auto absolute flex flex-col items-stretch justify-start overflow-hidden rounded px-1.5 py-1 text-left text-[11px] leading-tight ring-1 ring-black/5 hover:z-20 dark:ring-white/10 ${chipClass}`}
            style={{
              top: `${top}%`,
              height: `${height}%`,
              left: inset + 2,
              right: 2,
              zIndex: block.stack + 1,
            }}
            title={`${block.task.title} · ${priorityLabel(block.task.priority)}${isCompleted ? " · 완료" : ""}${scheduleLabel ? ` · ${scheduleLabel}` : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onTaskClick?.(block.task);
            }}
          >
            <span className="block truncate font-medium">{block.task.title}</span>
            <span className="block tabular-nums opacity-80">{timeLabel}</span>
          </button>
        );
      })}

      {isToday && nowMin >= 0 && nowMin <= MINUTES_IN_DAY && (
        <div
          className="pointer-events-none absolute right-0 left-0 z-[2] border-t border-red-500"
          style={{ top: (nowMin / MINUTES_IN_DAY) * 100 + "%" }}
        >
          <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-red-500" />
        </div>
      )}
    </div>
  );
}

function TimelineChip({
  task,
  onClick,
}: {
  task: TaskDto;
  onClick?: (task: TaskDto) => void;
}) {
  const isCompleted = task.status === "completed";
  const chipClass = isCompleted
    ? "bg-slate-100 text-slate-500 hover:bg-slate-200/80 dark:bg-slate-700/50 dark:text-slate-400 dark:hover:bg-slate-700/70"
    : priorityCalendarChipClass(task.priority);
  const scheduleLabel = formatTaskScheduleLabel(task);

  return (
    <button
      type="button"
      className={`w-full truncate rounded px-2 py-1 text-left text-[11px] ${chipClass}`}
      title={`${task.title} · ${priorityLabel(task.priority)}${isCompleted ? " · 완료" : ""}${scheduleLabel ? ` · ${scheduleLabel}` : ""}`}
      onClick={() => onClick?.(task)}
    >
      {task.title}
      <span className="ml-1 opacity-70">종일</span>
    </button>
  );
}

function currentMinutes(): number {
  const { hour, minute } = getTimePartsInSeoul(new Date());
  return hour * 60 + minute;
}

function formatMinutes(total: number): string {
  const clamped = Math.min(MINUTES_IN_DAY, Math.max(0, total));
  if (clamped === MINUTES_IN_DAY) return "24:00";
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

