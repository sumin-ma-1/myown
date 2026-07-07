export type WorkflowUiStatus = "planned" | "in_progress" | "completed";
export type ActiveWorkflowStatus = "planned" | "in_progress";

const LABELS: Record<WorkflowUiStatus, string> = {
  planned: "계획",
  in_progress: "진행 중",
  completed: "완료",
};

const STYLES: Record<WorkflowUiStatus, string> = {
  planned: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900",
  in_progress: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
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
