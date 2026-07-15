import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { TaskDto } from "@/api/types";
import { CalendarPanel } from "@/components/dashboard/CalendarPanel";
import { DdaySettingsModal } from "@/components/dashboard/DdaySettingsModal";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { RotatingSubtitle, DASHBOARD_SUBTITLE_MESSAGES } from "@/components/ui/RotatingSubtitle";
import { DueTodayCard, InProgressCard, PlannedCard } from "@/components/dashboard/SummaryCards";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";

export function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [ddayModalOpen, setDdayModalOpen] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();
  const [createDueDate, setCreateDueDate] = useState<string | undefined>();

  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ["tasks-today"],
    queryFn: api.listTodayTasks,
  });

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ["tasks", "active"],
    queryFn: () => api.listTasks({ status: "active", sort: "priority" }),
  });

  const openCreate = (dueDate?: string) => {
    setEditingTaskId(undefined);
    setCreateDueDate(dueDate);
    setModalOpen(true);
  };

  const openEdit = (task: TaskDto) => {
    setEditingTaskId(task.id);
    setCreateDueDate(undefined);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setCreateDueDate(undefined);
  };

  if (todayLoading || activeLoading) {
    return <p className="text-slate-500">불러오는 중…</p>;
  }

  const today = todayData?.items ?? [];
  const active = activeData?.items ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">나의 일정</h1>
          <RotatingSubtitle messages={DASHBOARD_SUBTITLE_MESSAGES} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => setDdayModalOpen(true)}
          >
            <span className="material-icons text-[18px] leading-none" aria-hidden>
              alarm
            </span>
            D-DAY
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
            onClick={() => openCreate()}
          >
            <span className="material-icons text-[18px] leading-none" aria-hidden>
              add_circle
            </span>
            새 업무 등록
          </button>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        <DueTodayCard tasks={today} onTaskClick={openEdit} />
        <InProgressCard tasks={active} onTaskClick={openEdit} />
        <PlannedCard tasks={active} onTaskClick={openEdit} />
      </div>

      <CalendarPanel
        onTaskClick={openEdit}
        onEmptyDayClick={(dateKey) => openCreate(dateKey)}
      />

      <TaskFormModal
        open={modalOpen}
        mode={editingTaskId ? "edit" : "create"}
        taskId={editingTaskId}
        initialDueDate={createDueDate}
        onClose={closeModal}
        onSaved={setFlashMessage}
      />

      <DdaySettingsModal
        open={ddayModalOpen}
        onClose={() => setDdayModalOpen(false)}
        onSaved={setFlashMessage}
      />

      <FlashMessage message={flashMessage} onDismiss={() => setFlashMessage(null)} />
    </div>
  );
}
