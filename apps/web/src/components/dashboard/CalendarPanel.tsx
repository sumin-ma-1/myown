import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { TaskDto } from "@/api/types";
import { Card } from "@/components/ui/Card";
import { CardTitle } from "@/components/ui/CardTitle";
import {
  addMonths,
  addWeeks,
  buildWeekDays,
  endOfDay,
  endOfMonth,
  formatLocalDateKey,
  localDateKeyFromIso,
  sameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  formatDateTime,
  formatDueTime,
} from "@/lib/dates";
import { priorityCalendarChipClass, priorityLabel } from "@/lib/priority";

type CalendarView = "month" | "week";

/** Max task chips shown per day in month view before "+N more". */
const MONTH_DAY_TASK_PREVIEW = 3;
const CALENDAR_TASK_TEXT_CLASS = "text-xs";

const PRIORITY_RANK: Record<TaskDto["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
};

function CalendarTaskChip({
  task,
  onClick,
}: {
  task: TaskDto;
  onClick?: (task: TaskDto) => void;
}) {
  const dueTime = formatDueTime(task.dueAt);
  const isCompleted = task.status === "completed";

  return (
    <button
      type="button"
      className={`flex w-full min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left ${CALENDAR_TASK_TEXT_CLASS} ${priorityCalendarChipClass(task.priority)} ${isCompleted ? "opacity-60" : ""}`}
      title={`${task.title} · ${priorityLabel(task.priority)}${isCompleted ? " · 완료" : ""}${task.dueAt ? ` · ${formatDateTime(task.dueAt)}` : ""}`}
      onClick={() => onClick?.(task)}
    >
      {dueTime && (
        <span className="shrink-0 tabular-nums opacity-80">{dueTime}</span>
      )}
      <span className="min-w-0 truncate">{task.title}</span>
    </button>
  );
}

function sortTasksForCalendar(tasks: TaskDto[]): TaskDto[] {
  return [...tasks].sort((a, b) => {
    const statusRank = (task: TaskDto) => (task.status === "completed" ? 1 : 0);
    const byStatus = statusRank(a) - statusRank(b);
    if (byStatus !== 0) return byStatus;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
}

function buildMonthGrid(cursor: Date): Date[] {
  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  const gridStart = startOfWeek(start);
  const days: Date[] = [];
  const d = new Date(gridStart);
  while (d <= end || days.length % 7 !== 0) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
    if (days.length > 42) break;
  }
  return days;
}

function formatWeekLabel(days: Date[]): string {
  const fmt = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });
  return `${fmt.format(days[0]!)} ~ ${fmt.format(days[6]!)}`;
}

export function CalendarPanel({
  onTaskClick,
}: {
  onTaskClick?: (task: TaskDto) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date());
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

  const { data: calendarData } = useQuery({
    queryKey: [
      "calendar",
      view,
      showCompleted,
      formatLocalDateKey(visibleRange.from),
      formatLocalDateKey(visibleRange.to),
    ],
    queryFn: () =>
      api.listCalendarTasks(
        visibleRange.from.toISOString(),
        visibleRange.to.toISOString(),
        { includeCompleted: showCompleted },
      ),
  });

  const tasks = calendarData?.items ?? [];

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const task of tasks) {
      if (!task.dueAt) continue;
      const key = localDateKeyFromIso(task.dueAt);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
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

  const goToday = () => setCursor(new Date());

  return (
    <Card
      title={
        <CardTitle icon="calendar_month" iconClassName="text-brand dark:text-blue-400">
          일정 캘린더
        </CardTitle>
      }
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
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
      className="col-span-full"
    >
      {view === "month" ? (
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
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
            return (
              <div
                key={key}
                className={`min-h-20 rounded-lg border p-1 text-left ${
                  inMonth
                    ? "border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800/60"
                    : "border-transparent bg-slate-50 text-slate-400 dark:bg-slate-900/40 dark:text-slate-500"
                } ${
                  isToday
                    ? "border-brand/50 bg-brand-muted/40 ring-2 ring-brand/40 dark:border-blue-400 dark:bg-blue-950/55 dark:ring-blue-400/70"
                    : ""
                }`}
              >
                <div
                  className={`mb-1 text-[11px] font-medium ${
                    isToday
                      ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 font-semibold text-white"
                      : ""
                  }`}
                >
                  {day.getDate()}
                </div>
                <ul className="space-y-1">
                  {dayTasks.slice(0, MONTH_DAY_TASK_PREVIEW).map((t) => (
                    <li key={t.id}>
                      <CalendarTaskChip task={t} onClick={onTaskClick} />
                    </li>
                  ))}
                  {dayTasks.length > MONTH_DAY_TASK_PREVIEW && (
                    <li
                      className={`${CALENDAR_TASK_TEXT_CLASS} text-slate-500 dark:text-slate-400`}
                      title={dayTasks
                        .slice(MONTH_DAY_TASK_PREVIEW)
                        .map((t) => t.title)
                        .join(", ")}
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
        <div className="grid grid-cols-7 gap-2 text-xs">
          {weekDays.map((day) => {
            const key = formatLocalDateKey(day);
            const dayTasks = tasksByDay.get(key) ?? [];
            const isToday = sameDay(day, new Date());
            return (
              <div
                key={key}
                className={`min-h-32 rounded-lg border p-2 text-left ${
                  isToday
                    ? "border-brand/50 bg-brand-muted/40 ring-2 ring-brand/40 dark:border-blue-400 dark:bg-blue-950/55 dark:ring-blue-400/70"
                    : "border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800/60"
                }`}
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
                  <p className={`${CALENDAR_TASK_TEXT_CLASS} text-slate-400 dark:text-slate-500`}>업무 없음</p>
                ) : (
                  <ul className="space-y-1">
                    {dayTasks.map((t) => (
                      <li key={t.id}>
                        <CalendarTaskChip task={t} onClick={onTaskClick} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
