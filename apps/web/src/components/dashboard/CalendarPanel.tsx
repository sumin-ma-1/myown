import { useMemo, useState } from "react";
import type { TaskDto } from "@/api/types";
import { Card } from "@/components/ui/Card";
import {
  addMonths,
  endOfMonth,
  formatDday,
  sameDay,
  startOfMonth,
} from "@/lib/dates";

type CalendarView = "month" | "week";

function buildMonthGrid(cursor: Date): Date[] {
  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const days: Date[] = [];
  const d = new Date(gridStart);
  while (d <= end || days.length % 7 !== 0) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
    if (days.length > 42) break;
  }
  return days;
}

export function CalendarPanel({ tasks }: { tasks: TaskDto[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("month");

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const task of tasks) {
      if (!task.dueAt) continue;
      const key = task.dueAt.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const monthDays = buildMonthGrid(cursor);
  const label = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(cursor);

  return (
    <Card
      title="달력"
      action={
        <div className="flex items-center gap-2">
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
            className="rounded-md border px-2 py-1 text-xs"
            onClick={() => setCursor(addMonths(cursor, -1))}
          >
            ◀
          </button>
          <span className="min-w-28 text-center text-xs font-medium">{label}</span>
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs"
            onClick={() => setCursor(addMonths(cursor, 1))}
          >
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
            const key = day.toISOString().slice(0, 10);
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
                  <div
                    key={t.id}
                    className="truncate rounded bg-brand-muted px-1 text-[10px] text-brand"
                    title={t.title}
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 2 && (
                  <div className="text-[10px] text-slate-500">+{dayTasks.length - 2}</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from({ length: 7 }, (_, i) => {
            const day = new Date(cursor);
            day.setDate(day.getDate() - day.getDay() + i);
            const key = day.toISOString().slice(0, 10);
            const dayTasks = tasksByDay.get(key) ?? [];
            return (
              <div key={key} className="rounded-lg border border-slate-200 p-2">
                <p className="mb-1 text-xs font-semibold text-slate-600">
                  {new Intl.DateTimeFormat("ko-KR", {
                    weekday: "short",
                    month: "numeric",
                    day: "numeric",
                  }).format(day)}
                </p>
                {dayTasks.length === 0 ? (
                  <p className="text-xs text-slate-400">업무 없음</p>
                ) : (
                  <ul className="space-y-1">
                    {dayTasks.map((t) => (
                      <li key={t.id} className="flex justify-between text-xs">
                        <span className="truncate">{t.title}</span>
                        {t.dday !== null && (
                          <span className="shrink-0 text-brand">{formatDday(t.dday)}</span>
                        )}
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
