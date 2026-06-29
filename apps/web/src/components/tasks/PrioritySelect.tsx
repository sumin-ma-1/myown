import type { TaskDto } from "@/api/types";
import { api } from "@/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PRIORITY_OPTIONS, priorityClass } from "@/lib/priority";

export function PrioritySelect({ task }: { task: TaskDto }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (priority: TaskDto["priority"]) => api.updateTask(task.id, { priority }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <select
      className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${priorityClass(task.priority)}`}
      value={task.priority}
      disabled={mutation.isPending}
      onChange={(e) => mutation.mutate(e.target.value as TaskDto["priority"])}
    >
      {PRIORITY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
