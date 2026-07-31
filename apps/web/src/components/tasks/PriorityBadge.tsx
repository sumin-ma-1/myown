import type { TaskPriority } from "@/api/types";
import { priorityClass, priorityLabel } from "@/lib/priority";

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium shadow-[0_1px_1px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] ${priorityClass(priority)}`}
    >
      {priorityLabel(priority)}
    </span>
  );
}
