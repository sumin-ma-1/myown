export type WorkflowUiStatus = "planned" | "in_progress" | "completed";

const STYLES: Record<WorkflowUiStatus, string> = {
  planned: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900",
  in_progress: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
};

export function statusClass(status: WorkflowUiStatus): string {
  return STYLES[status];
}
