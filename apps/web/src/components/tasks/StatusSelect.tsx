import type { TaskDto } from "@/api/types";
import { api } from "@/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { statusClass, type WorkflowUiStatus } from "@/lib/status";

const OPTIONS = [
  { value: "planned", label: "예정" },
  { value: "in_progress", label: "진행 중" },
  { value: "completed", label: "완료" },
] as const;

export function StatusSelect({ task }: { task: TaskDto }) {
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  return (
    <select
      className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${statusClass(value)}`}
      value={value}
      disabled={mutation.isPending}
      onChange={(e) => mutation.mutate(e.target.value)}
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
