import type { TaskPriority } from "@/api/types";
import { priorityClass, priorityLabel } from "@/lib/priority";

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${priorityClass(priority)}`}
    >
      {priorityLabel(priority)}
    </span>
  );
}
