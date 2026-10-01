import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { TaskDto } from "@/api/types";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { TaskTable } from "@/components/tasks/TaskTable";
import { FlashMessage } from "@/components/ui/FlashMessage";

export function TaskListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort] = useState("priority");
  const [status, setStatus] = useState("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["tasks", status, sort],
    queryFn: () => api.listTasks({ status, sort }),
  });

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;

    setEditingTaskId(openId);
    setModalOpen(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("open");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const openEdit = (task: TaskDto) => {
    setEditingTaskId(task.id);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-red-600">
          {error instanceof Error ? error.message : "데이터를 불러오지 못했습니다."}
        </p>
      ) : null}
      {isLoading ? <p className="text-slate-500">불러오는 중…</p> : null}

      <TaskTable
        tasks={data?.items ?? []}
        sort={sort}
        onSortChange={setSort}
        showCompletedAt={status !== "active"}
        onTaskClick={openEdit}
        onSaved={setFlashMessage}
        toolbarStart={
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
                  status === opt.value
                    ? "bg-brand text-white"
                    : "border border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300"
                }`}
                onClick={() => setStatus(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      <TaskFormModal
        open={modalOpen}
        mode={editingTaskId ? "edit" : "create"}
        taskId={editingTaskId}
        onClose={() => setModalOpen(false)}
        onSaved={setFlashMessage}
      />

      <FlashMessage message={flashMessage} onDismiss={() => setFlashMessage(null)} />
    </div>
  );
}
