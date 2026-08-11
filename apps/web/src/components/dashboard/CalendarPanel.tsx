import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { TaskDto } from "@/api/types";
import { Card } from "@/components/ui/Card";
import { CardTitle } from "@/components/ui/CardTitle";
import { DayTimeline } from "@/components/dashboard/DayTimeline";
import {
  addMonths,
  addWeeks,
  buildWeekDays,
  dateFromLocalKey,
  endOfDay,
  formatLocalDateKey,
  sameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  formatDueTime,
  formatTaskScheduleLabel,
  taskSpanDayKeys,
} from "@/lib/dates";
import { priorityCalendarChipClass, priorityLabel } from "@/lib/priority";

type CalendarView = "month" | "week";
/** 주(일~토) 세그먼트 기준 역할 — 주 경계에서 start가 다시 열림 */
type SpanRole = "single" | "start" | "middle" | "end";

/** Max task chips shown per day in month view before "+N more". */
const MONTH_DAY_TASK_PREVIEW = 3;
/** 월별 6주 그리드와 주별 뷰를 같은 높이로 맞춤 */
const CALENDAR_BODY_MIN_H = "min-h-[33rem]";
const CALENDAR_TASK_TEXT_CLASS = "text-xs";
const DAY_CELL_HOVER_CLASS =
  "relative transition-transform duration-200 ease-out hover:z-10 hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20";

const PRIORITY_RANK: Record<TaskDto["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
};

function weekdayFromDayKey(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y!, m! - 1, d!).getDay();
}

/** 연속일을 주 단위 세그먼트로 나눠 start/middle/end 결정 (일요일 주 시작) */
function spanRoleForDay(task: TaskDto, dayKey: string): SpanRole {
  const keys = taskSpanDayKeys(task);
  if (keys.length <= 1) return "single";
  const index = keys.indexOf(dayKey);
  if (index < 0) return "single";

  const weekday = weekdayFromDayKey(dayKey);
  const isSegStart = index === 0 || weekday === 0;
  const isSegEnd = index === keys.length - 1 || weekday === 6;

  if (isSegStart && isSegEnd) return "single";
  if (isSegStart) return "start";
  if (isSegEnd) return "end";
  return "middle";
}

function CalendarTaskChip({
  task,
  dayKey,
  onClick,
}: {
  task: TaskDto;
  dayKey: string;
  onClick?: (task: TaskDto) => void;
}) {
  const role = spanRoleForDay(task, dayKey);
  const spanKeys = taskSpanDayKeys(task);
  const isMultiDay = spanKeys.length > 1;
  const isSpanStart = spanKeys[0] === dayKey;
  const isSpanEnd = spanKeys[spanKeys.length - 1] === dayKey;
  const isAllDay = task.allDay || !formatDueTime(task.dueAt, task.allDay);

  // 주 시작 세그먼트·기간 시작은 진한 제목, 그 외(중간·끝)는 연한 제목
  const showPrimaryTitle =
    !isMultiDay || role === "start" || (role === "single" && isSpanStart);

  const startTime = isAllDay ? null : formatDueTime(task.startsAt, false);
  const endTime = isAllDay ? null : formatDueTime(task.dueAt, false);

  let timeLeft: string | null = null;
  let timeRight: string | null = null;
  if (!isAllDay) {
    if (!isMultiDay) {
      if (startTime && endTime && startTime !== endTime) {
        timeLeft = `${startTime}–${endTime}`;
      } else {
        timeLeft = startTime ?? endTime;
      }
    } else if (showPrimaryTitle) {
      timeLeft = startTime;
    }
    if (isMultiDay && isSpanEnd && endTime) {
      timeRight = endTime;
    }
  }

  const isCompleted = task.status === "completed";
  const chipClass = isCompleted
    ? "bg-slate-100 text-slate-500 hover:bg-slate-200/80 dark:bg-slate-700/50 dark:text-slate-400 dark:hover:bg-slate-700/70"
    : priorityCalendarChipClass(task.priority);

  const radius =
    role === "start"
      ? "rounded-l rounded-r-none"
      : role === "end"
        ? "rounded-r rounded-l-none"
        : role === "middle"
          ? "rounded-none"
          : "rounded";

  const scheduleLabel = formatTaskScheduleLabel(task);
  const bridgeGap = isMultiDay && role !== "single";

  return (
    <button
      type="button"
      className={`flex min-h-[1.25rem] w-full min-w-0 items-center gap-1 px-1 py-0.5 text-left ${CALENDAR_TASK_TEXT_CLASS} ${chipClass} ${radius} ${
        bridgeGap ? "relative z-[1] -mx-0.5 w-[calc(100%+0.25rem)]" : ""
      }`}
      title={`${task.title} · ${priorityLabel(task.priority)}${isCompleted ? " · 완료" : ""}${scheduleLabel ? ` · ${scheduleLabel}` : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(task);
      }}
    >
      {timeLeft && (
        <span className="shrink-0 tabular-nums opacity-80">{timeLeft}</span>
      )}
      <span
        className={`min-w-0 flex-1 truncate ${
          showPrimaryTitle ? "" : "opacity-40 dark:opacity-35"
        }`}
      >
        {task.title}
      </span>
      {timeRight && (
        <span className="shrink-0 tabular-nums opacity-80">{timeRight}</span>
      )}
    </button>
  );
}

function sortTasksForCalendar(tasks: TaskDto[]): TaskDto[] {
  return [...tasks].sort((a, b) => {
    const statusRank = (task: TaskDto) => (task.status === "completed" ? 1 : 0);
    const byStatus = statusRank(a) - statusRank(b);
    if (byStatus !== 0) return byStatus;

    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;

    const timeMs = (task: TaskDto) => {
      const iso = task.startsAt ?? task.dueAt;
      if (!iso) return Number.POSITIVE_INFINITY;
      const t = new Date(iso).getTime();
      return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
    };
    const byTime = timeMs(a) - timeMs(b);
    if (byTime !== 0) return byTime;

    return a.title.localeCompare(b.title, "ko");
  });
}

function buildMonthGrid(cursor: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(cursor));
  const days: Date[] = [];
  const d = new Date(gridStart);
  while (days.length < 42) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function formatWeekLabel(days: Date[]): string {
  const fmt = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });
  return `${fmt.format(days[0]!)} ~ ${fmt.format(days[6]!)}`;
}

function dayCellToneClass({
  isToday,
  isSelected,
  inMonth,
}: {
  isToday: boolean;
  isSelected: boolean;
  inMonth: boolean;
}): string {
  const selected = isSelected
    ? "border-[#dbeafe] ring-2 ring-[#dbeafe]/80 dark:border-[#dbeafe]/70 dark:ring-[#dbeafe]/25"
    : "";
  if (isToday) {
    return `border-brand/50 bg-brand-muted/40 ring-2 ring-brand/40 dark:border-blue-400 dark:bg-blue-950/55 dark:ring-blue-400/70 ${
      isSelected ? "border-[#dbeafe] dark:border-[#dbeafe]/70" : ""
    }`;
  }
  if (inMonth) {
    return `${selected} border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800/60`;
  }
  return `${selected} border-transparent bg-slate-50 text-slate-400 dark:bg-slate-900/40 dark:text-slate-500`;
}

export function CalendarPanel({
  onTaskClick,
  onEmptyDayClick,
}: {
  onTaskClick?: (task: TaskDto) => void;
  /** 날짜 더블클릭 또는 타임라인 시간대 클릭 (YYYY-MM-DD, 선택적 HH:mm) */
  onEmptyDayClick?: (dateKey: string, dueTime?: string) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => formatLocalDateKey(new Date()));
  const [view, setView] = useState<CalendarView>("month");
  const [showCompleted, setShowCompleted] = useState(false);

  const monthDays = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const weekDays = useMemo(() => buildWeekDays(cursor), [cursor]);

  const visibleRange = useMemo(() => {
    if (view === "month") {
      const first = monthDays[0]!;
      const last = monthDays[monthDays.length - 1]!;
      return { from: startOfDay(first), to: endOfDay(last) };
    }
    return { from: startOfDay(weekDays[0]!), to: endOfDay(weekDays[6]!) };
  }, [view, monthDays, weekDays]);

  const queryRange = useMemo(() => {
    const selected = dateFromLocalKey(selectedKey);
    const from =
      visibleRange.from.getTime() < startOfDay(selected).getTime()
        ? visibleRange.from
        : startOfDay(selected);
    const to =
      visibleRange.to.getTime() > endOfDay(selected).getTime()
        ? visibleRange.to
        : endOfDay(selected);
    return { from, to };
  }, [visibleRange, selectedKey]);

  const { data: calendarData } = useQuery({
    queryKey: [
      "calendar",
      view,
      showCompleted,
      formatLocalDateKey(queryRange.from),
      formatLocalDateKey(queryRange.to),
    ],
    queryFn: () =>
      api.listCalendarTasks(
        queryRange.from.toISOString(),
        queryRange.to.toISOString(),
        { includeCompleted: showCompleted },
      ),
  });

  const tasks = calendarData?.items ?? [];

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const task of tasks) {
      if (!task.dueAt) continue;
      for (const key of taskSpanDayKeys(task)) {
        const list = map.get(key) ?? [];
        list.push(task);
        map.set(key, list);
      }
    }
    for (const [key, list] of map) {
      map.set(key, sortTasksForCalendar(list));
    }
    return map;
  }, [tasks]);

  const headerLabel =
    view === "month"
      ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(cursor)
      : formatWeekLabel(weekDays);

  const goPrev = () => {
    setCursor((current) => (view === "month" ? addMonths(current, -1) : addWeeks(current, -1)));
  };

  const goNext = () => {
    setCursor((current) => (view === "month" ? addMonths(current, 1) : addWeeks(current, 1)));
  };

  const goToday = () => {
    const today = new Date();
    setCursor(today);
    setSelectedKey(formatLocalDateKey(today));
  };

  const selectDay = (key: string) => setSelectedKey(key);

  const scrollCalendarIntoView = () => {
    document.getElementById("schedule-calendar")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <Card
      id="schedule-calendar"
      variant="glass"
      onClick={scrollCalendarIntoView}
      title={
        <CardTitle icon="calendar_month" iconClassName="text-brand dark:text-blue-400">
          일정 캘린더
        </CardTitle>
      }
      action={
        <div
          className="flex flex-wrap items-center justify-end gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs ${
              showCompleted
                ? "border-brand bg-brand text-white"
                : "border-surface-border text-slate-600 dark:border-slate-600 dark:text-slate-300"
            }`}
            onClick={() => setShowCompleted((value) => !value)}
            aria-pressed={showCompleted}
          >
            완료 일정 포함
          </button>
          <div className="flex rounded-lg border border-surface-border p-0.5 text-xs dark:border-slate-600">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`rounded-md px-2 py-1 ${
                  view === v ? "bg-brand text-white" : "text-slate-600 dark:text-slate-300"
                }`}
                onClick={() => setView(v)}
              >
                {v === "month" ? "월별" : "주별"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded-md border border-surface-border px-2 py-1 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300"
            onClick={goToday}
          >
            오늘
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            onClick={goPrev}
            aria-label="이전"
          >
            <span className="material-icons text-[16px] leading-none" aria-hidden>
              chevron_left
            </span>
          </button>
          <span className="min-w-28 text-center text-xs font-medium dark:text-slate-200">{headerLabel}</span>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            onClick={goNext}
            aria-label="다음"
          >
            <span className="material-icons text-[16px] leading-none" aria-hidden>
              chevron_right
            </span>
          </button>
        </div>
      }
      className="col-span-full scroll-mt-6"
    >
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className={`min-w-0 ${CALENDAR_BODY_MIN_H}`}>
          {view === "month" ? (
            <div className="grid h-full grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-1 text-center text-xs">
              {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                <div key={d} className="py-1 font-semibold text-slate-500 dark:text-slate-400">
                  {d}
                </div>
              ))}
              {monthDays.map((day) => {
                const key = formatLocalDateKey(day);
                const dayTasks = tasksByDay.get(key) ?? [];
                const inMonth = day.getMonth() === cursor.getMonth();
                const isToday = sameDay(day, new Date());
                const isSelected = key === selectedKey;
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    className={`min-h-0 cursor-pointer rounded-lg border p-1 text-left ${DAY_CELL_HOVER_CLASS} ${dayCellToneClass(
                      { isToday, isSelected, inMonth },
                    )}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectDay(key);
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      onEmptyDayClick?.(key);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        selectDay(key);
                      }
                    }}
                  >
                    <div
                      className={`mb-1 text-[11px] font-semibold ${
                        isToday
                          ? "text-brand dark:text-blue-300"
                          : inMonth
                            ? "font-medium text-slate-700 dark:text-slate-200"
                            : "font-medium"
                      }`}
                    >
                      {day.getDate()}
                    </div>
                    <ul className="space-y-1">
                      {dayTasks.slice(0, MONTH_DAY_TASK_PREVIEW).map((t) => (
                        <li key={t.id}>
                          <CalendarTaskChip task={t} dayKey={key} onClick={onTaskClick} />
                        </li>
                      ))}
                      {dayTasks.length > MONTH_DAY_TASK_PREVIEW && (
                        <li
                          className={`${CALENDAR_TASK_TEXT_CLASS} text-slate-500 dark:text-slate-400`}
                          title={dayTasks
                            .slice(MONTH_DAY_TASK_PREVIEW)
                            .map((t) => t.title)
                            .join(", ")}
                          onClick={(event) => event.stopPropagation()}
                        >
                          +{dayTasks.length - MONTH_DAY_TASK_PREVIEW}
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid h-full grid-cols-7 gap-2 text-xs">
              {weekDays.map((day) => {
                const key = formatLocalDateKey(day);
                const dayTasks = tasksByDay.get(key) ?? [];
                const isToday = sameDay(day, new Date());
                const isSelected = key === selectedKey;
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    className={`min-h-0 cursor-pointer rounded-lg border p-2 text-left ${DAY_CELL_HOVER_CLASS} ${dayCellToneClass(
                      { isToday, isSelected, inMonth: true },
                    )}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectDay(key);
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      onEmptyDayClick?.(key);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        selectDay(key);
                      }
                    }}
                  >
                    <p
                      className={`mb-2 text-[11px] font-semibold ${
                        isToday
                          ? "text-brand dark:text-blue-300"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {new Intl.DateTimeFormat("ko-KR", {
                        weekday: "short",
                        month: "numeric",
                        day: "numeric",
                      }).format(day)}
                    </p>
                    {dayTasks.length === 0 ? (
                      <p className={`${CALENDAR_TASK_TEXT_CLASS} text-slate-400 dark:text-slate-500`}>
                        일정 없음
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {dayTasks.map((t) => (
                          <li key={t.id}>
                            <CalendarTaskChip task={t} dayKey={key} onClick={onTaskClick} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={`relative ${CALENDAR_BODY_MIN_H} lg:min-h-0`}>
          <div className={`flex h-full ${CALENDAR_BODY_MIN_H} flex-col lg:absolute lg:inset-0 lg:min-h-0`}>
            <DayTimeline
              dayKey={selectedKey}
              tasks={tasksByDay.get(selectedKey) ?? []}
              onTaskClick={onTaskClick}
              onSlotClick={onEmptyDayClick}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
