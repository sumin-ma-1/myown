import type { TaskPriority } from "@/api/types";

const LABELS: Record<TaskPriority, string> = {
  urgent: "최우선",
  high: "우선",
  medium: "보통",
  low: "계획",
};

const STYLES: Record<TaskPriority, string> = {
  urgent: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-sky-100 text-sky-800 border-sky-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

export function priorityLabel(priority: TaskPriority): string {
  return LABELS[priority];
}

export function priorityClass(priority: TaskPriority): string {
  return STYLES[priority];
}

export const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low"];
