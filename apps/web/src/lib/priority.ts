import type { TaskPriority } from "@/api/types";

const LABELS: Record<TaskPriority, string> = {
  urgent: "최우선",
  high: "우선",
  medium: "일반",
};

const STYLES: Record<TaskPriority, string> = {
  urgent: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900",
  high: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900",
  medium: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
};

const CALENDAR_CHIP_STYLES: Record<TaskPriority, string> = {
  urgent:
    "bg-red-100 text-red-800 hover:bg-red-200/80 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50",
  high:
    "bg-orange-100 text-orange-800 hover:bg-orange-200/80 dark:bg-orange-950/50 dark:text-orange-300 dark:hover:bg-orange-900/50",
  medium:
    "bg-brand-muted text-brand hover:bg-brand/10 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50",
};

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "urgent", label: "최우선" },
  { value: "high", label: "우선" },
  { value: "medium", label: "일반" },
];

export function priorityLabel(priority: TaskPriority): string {
  return LABELS[priority];
}

export function priorityClass(priority: TaskPriority): string {
  return STYLES[priority];
}

export function priorityCalendarChipClass(priority: TaskPriority): string {
  return CALENDAR_CHIP_STYLES[priority];
}
