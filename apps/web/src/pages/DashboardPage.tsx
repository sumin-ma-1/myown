import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { CalendarPanel } from "@/components/dashboard/CalendarPanel";
import { DdaySettingsCard } from "@/components/dashboard/DdaySettingsCard";
import { DueTodayCard, InProgressCard } from "@/components/dashboard/SummaryCards";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { endOfMonth, startOfMonth } from "@/lib/dates";

export function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);
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
        <button
          type="button"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
          onClick={() => setModalOpen(true)}
        >
          새 업무 등록
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <DueTodayCard tasks={today} />
        <InProgressCard tasks={active} />
        <DdaySettingsCard />
      </div>

      <CalendarPanel tasks={calendar} />

      <TaskFormModal open={modalOpen} mode="create" onClose={() => setModalOpen(false)} />
    </div>
  );
}
