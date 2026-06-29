export type WorkflowUiStatus = "planned" | "in_progress" | "completed";

const STYLES: Record<WorkflowUiStatus, string> = {
  planned: "bg-sky-100 text-sky-800 border-sky-200",
  in_progress: "bg-amber-100 text-amber-900 border-amber-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function statusClass(status: WorkflowUiStatus): string {
  return STYLES[status];
}
