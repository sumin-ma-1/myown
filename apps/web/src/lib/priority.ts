import type { TaskPriority } from "@/api/types";

const LABELS: Record<TaskPriority, string> = {
  urgent: "최우선",
  high: "우선",
  medium: "계획",
};

const STYLES: Record<TaskPriority, string> = {
  urgent: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900",
  high: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900",
  medium: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
};

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "urgent", label: "최우선" },
  { value: "high", label: "우선" },
  { value: "medium", label: "계획" },
];

export function priorityLabel(priority: TaskPriority): string {
  return LABELS[priority];
}

export function priorityClass(priority: TaskPriority): string {
  return STYLES[priority];
}
