import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { TaskDto } from "@/api/types";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { TaskTable } from "@/components/tasks/TaskTable";
import { RotatingSubtitle, TASK_LIST_SUBTITLE_MESSAGES } from "@/components/ui/RotatingSubtitle";

export function TaskListPage() {
  const [sort, setSort] = useState("priority");
  const [status, setStatus] = useState("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["tasks", status, sort],
    queryFn: () => api.listTasks({ status, sort }),
  });

  const openCreate = () => {
    setEditingTaskId(undefined);
    setModalOpen(true);
  };

  const openEdit = (task: TaskDto) => {
    setEditingTaskId(task.id);
    setModalOpen(true);
  };

  if (isLoading) return <p className="text-slate-500">불러오는 중…</p>;
  if (error) {
    return (
      <p className="text-red-600">
        {error instanceof Error ? error.message : "데이터를 불러오지 못했습니다."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">등록 업무 목록</h1>
          <RotatingSubtitle messages={TASK_LIST_SUBTITLE_MESSAGES} />
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
          onClick={openCreate}
        >
          <span className="material-icons text-[18px] leading-none" aria-hidden>
            add_circle
          </span>
          새 업무 등록
        </button>
      </header>

      <div className="flex gap-2 text-sm">
        {[
          { value: "active", label: "진행" },
          { value: "completed", label: "완료" },
          { value: "all", label: "전체" },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`rounded-lg px-3 py-1.5 ${
              status === opt.value ? "bg-brand text-white" : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setStatus(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <TaskTable
        tasks={data?.items ?? []}
        sort={sort}
        onSortChange={setSort}
        showCompletedAt={status !== "active"}
        onTaskClick={openEdit}
      />

      <TaskFormModal
        open={modalOpen}
        mode={editingTaskId ? "edit" : "create"}
        taskId={editingTaskId}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
