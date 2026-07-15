import type { TaskDto } from "@/api/types";
import { api } from "@/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { statusClass, WORKFLOW_STATUS_OPTIONS, type WorkflowUiStatus } from "@/lib/status";

function statusSavedMessage(next: string, wasCompleted: boolean): string {
  if (next === "completed") return "업무를 완료 처리했습니다.";
  if (wasCompleted) return "업무를 다시 진행으로 바꿨습니다.";
  if (next === "in_progress") return "상태를 진행 중으로 바꿨습니다.";
  return "상태를 예정으로 바꿨습니다.";
}

export function StatusSelect({
  task,
  onSaved,
}: {
  task: TaskDto;
  onSaved?: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const value: WorkflowUiStatus =
    task.status === "completed" ? "completed" : task.workflowStatus;

  const mutation = useMutation({
    mutationFn: async (next: string) => {
      if (next === "completed") {
        return api.updateTask(task.id, { status: "completed" });
      }
      if (task.status === "completed") {
        return api.updateTask(task.id, { status: "active", workflowStatus: "in_progress" });
      }
      return api.updateTask(task.id, {
        workflowStatus: next as "planned" | "in_progress",
      });
    },
    onSuccess: (_data, next) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      onSaved?.(statusSavedMessage(next, task.status === "completed"));
    },
  });

  return (
    <select
      className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${statusClass(value)}`}
      value={value}
      disabled={mutation.isPending}
      onChange={(e) => mutation.mutate(e.target.value)}
    >
      {WORKFLOW_STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
