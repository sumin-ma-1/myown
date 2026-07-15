export type WorkflowUiStatus = "planned" | "in_progress" | "completed";
export type ActiveWorkflowStatus = "planned" | "in_progress";

const LABELS: Record<WorkflowUiStatus, string> = {
  planned: "계획",
  in_progress: "진행 중",
  completed: "완료",
};

const STYLES: Record<WorkflowUiStatus, string> = {
  planned:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
  in_progress:
    "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-900",
  completed:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
};

export const WORKFLOW_STATUS_OPTIONS: { value: WorkflowUiStatus; label: string }[] = [
  { value: "planned", label: "계획" },
  { value: "in_progress", label: "진행 중" },
  { value: "completed", label: "완료" },
];

export const ACTIVE_WORKFLOW_OPTIONS: { value: ActiveWorkflowStatus; label: string }[] = [
  { value: "planned", label: "계획" },
  { value: "in_progress", label: "진행 중" },
];

export function workflowLabel(status: WorkflowUiStatus): string {
  return LABELS[status];
}

export function statusClass(status: WorkflowUiStatus): string {
  return STYLES[status];
}
