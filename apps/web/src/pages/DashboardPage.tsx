import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { TaskDto } from "@/api/types";
import { CalendarPanel } from "@/components/dashboard/CalendarPanel";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { DueTodayCard, InProgressCard, PlannedCard } from "@/components/dashboard/SummaryCards";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";

export function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();
  const [createDueDate, setCreateDueDate] = useState<string | undefined>();
  const [createDueTime, setCreateDueTime] = useState<string | undefined>();

  const { data: todayData, isLoading: todayLoading, error: todayError } = useQuery({
    queryKey: ["tasks-today"],
    queryFn: api.listTodayTasks,
  });

  const { data: activeData, isLoading: activeLoading, error: activeError } = useQuery({
    queryKey: ["tasks", "active"],
    queryFn: () => api.listTasks({ status: "active", sort: "priority" }),
  });

  const openCreate = (dueDate?: string, dueTime?: string) => {
    setEditingTaskId(undefined);
    setCreateDueDate(dueDate);
    setCreateDueTime(dueTime);
    setModalOpen(true);
  };

  const openEdit = (task: TaskDto) => {
    setEditingTaskId(task.id);
    setCreateDueDate(undefined);
    setCreateDueTime(undefined);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setCreateDueDate(undefined);
    setCreateDueTime(undefined);
  };

  const today = todayData?.items ?? [];
  const active = activeData?.items ?? [];
  const loadError =
    todayError instanceof Error
      ? todayError.message
      : activeError instanceof Error
        ? activeError.message
        : todayError || activeError
          ? "데이터를 불러오지 못했습니다."
          : null;

  return (
    <div className="space-y-6">
      {loadError && <p className="text-red-600">{loadError}</p>}
      {todayLoading || activeLoading ? (
        <p className="text-slate-500">불러오는 중…</p>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        <DueTodayCard
          tasks={today}
          onTaskClick={openEdit}
          onSlotClick={(dateKey, dueTime) => openCreate(dateKey, dueTime)}
        />
        <InProgressCard tasks={active} onTaskClick={openEdit} />
        <PlannedCard tasks={active} onTaskClick={openEdit} />
      </div>

      <CalendarPanel
        onTaskClick={openEdit}
        onEmptyDayClick={(dateKey, dueTime) => openCreate(dateKey, dueTime)}
      />

      <TaskFormModal
        open={modalOpen}
        mode={editingTaskId ? "edit" : "create"}
        taskId={editingTaskId}
        initialDueDate={createDueDate}
        initialDueTime={createDueTime}
        onClose={closeModal}
        onSaved={setFlashMessage}
      />

      <FlashMessage message={flashMessage} onDismiss={() => setFlashMessage(null)} />
    </div>
  );
}
