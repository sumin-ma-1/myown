import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { CalendarPanel } from "@/components/dashboard/CalendarPanel";
import { DdaySettingsCard } from "@/components/dashboard/DdaySettingsCard";
import { DueTodayCard, InProgressCard } from "@/components/dashboard/SummaryCards";
import { endOfMonth, startOfMonth } from "@/lib/dates";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const monthStart = useMemo(() => startOfMonth(new Date()), []);
  const monthEnd = useMemo(() => endOfMonth(new Date()), []);

  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ["tasks-today"],
    queryFn: api.listTodayTasks,
  });

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ["tasks", "active"],
    queryFn: () => api.listTasks({ status: "active", sort: "priority" }),
  });

  const { data: calendarData } = useQuery({
    queryKey: ["calendar", monthStart.toISOString()],
    queryFn: () =>
      api.listCalendarTasks(monthStart.toISOString(), monthEnd.toISOString()),
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => api.createTask({ title }),
    onSuccess: () => {
      setNewTitle("");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  if (todayLoading || activeLoading) {
    return <p className="text-slate-500">불러오는 중…</p>;
  }

  const today = todayData?.items ?? [];
  const active = activeData?.items ?? [];
  const calendar = calendarData?.items ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">메인 화면</h1>
          <p className="text-sm text-slate-500">오늘의 업무와 일정을 한눈에 확인합니다.</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newTitle.trim()) createMutation.mutate(newTitle.trim());
          }}
        >
          <input
            className="rounded-lg border border-surface-border px-3 py-2 text-sm"
            placeholder="새 업무 등록"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
            disabled={createMutation.isPending}
          >
            추가
          </button>
        </form>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <DueTodayCard tasks={today} />
        <InProgressCard tasks={active} />
        <DdaySettingsCard />
      </div>

      <CalendarPanel tasks={calendar} />
    </div>
  );
}
