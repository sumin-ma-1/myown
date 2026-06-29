import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { TaskDto } from "@/api/types";
import { Card } from "@/components/ui/Card";
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
} from "@/lib/dates";

type CalendarView = "month" | "week";

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
      formatLocalDateKey(visibleRange.from),
      formatLocalDateKey(visibleRange.to),
    ],
    queryFn: () =>
      api.listCalendarTasks(
        visibleRange.from.toISOString(),
        visibleRange.to.toISOString(),
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
      title="달력"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex rounded-lg border border-surface-border p-0.5 text-xs">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`rounded-md px-2 py-1 ${
                  view === v ? "bg-brand text-white" : "text-slate-600"
                }`}
                onClick={() => setView(v)}
              >
                {v === "month" ? "월별" : "주별"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs text-slate-600"
            onClick={goToday}
          >
            오늘
          </button>
          <button type="button" className="rounded-md border px-2 py-1 text-xs" onClick={goPrev}>
            ◀
          </button>
          <span className="min-w-28 text-center text-xs font-medium">{headerLabel}</span>
          <button type="button" className="rounded-md border px-2 py-1 text-xs" onClick={goNext}>
            ▶
          </button>
        </div>
      }
      className="col-span-full"
    >
      {view === "month" ? (
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div key={d} className="py-1 font-semibold text-slate-500">
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
                className={`min-h-16 rounded-lg border p-1 text-left ${
                  inMonth ? "border-slate-200 bg-white" : "border-transparent bg-slate-50 text-slate-400"
                } ${isToday ? "ring-2 ring-brand/30" : ""}`}
              >
                <div className="mb-1 text-[11px] font-medium">{day.getDate()}</div>
                {dayTasks.slice(0, 2).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="block w-full truncate rounded bg-brand-muted px-1 text-left text-[10px] text-brand hover:bg-brand/10"
                    title={t.title}
                    onClick={() => onTaskClick?.(t)}
                  >
                    {t.title}
                  </button>
                ))}
                {dayTasks.length > 2 && (
                  <div
                    className="text-[10px] text-slate-500"
                    title={dayTasks
                      .slice(2)
                      .map((t) => t.title)
                      .join(", ")}
                  >
                    +{dayTasks.length - 2}
                  </div>
                )}
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
                  isToday ? "border-brand/40 bg-brand-muted/30 ring-2 ring-brand/20" : "border-slate-200 bg-white"
                }`}
              >
                <p className="mb-2 text-[11px] font-semibold text-slate-600">
                  {new Intl.DateTimeFormat("ko-KR", {
                    weekday: "short",
                    month: "numeric",
                    day: "numeric",
                  }).format(day)}
                </p>
                {dayTasks.length === 0 ? (
                  <p className="text-[10px] text-slate-400">업무 없음</p>
                ) : (
                  <ul className="space-y-1">
                    {dayTasks.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          className="block w-full truncate rounded bg-brand-muted px-1 py-0.5 text-left text-[10px] text-brand hover:bg-brand/10"
                          title={t.title}
                          onClick={() => onTaskClick?.(t)}
                        >
                          {t.title}
                        </button>
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
