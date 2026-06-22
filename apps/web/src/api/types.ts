export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "active" | "completed" | "cancelled";
export type WorkflowStatus = "planned" | "in_progress";

export interface TaskDto {
  id: string;
  listIndex: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  workflowStatus: WorkflowStatus;
  priority: TaskPriority;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachment: {
    id: string;
    fileName: string;
    status: string;
  } | null;
  reminderSummary: {
    pending: number;
    sent: number;
    nextFireAt: string | null;
  };
  dday: number | null;
}

export interface ReminderDto {
  id: string;
  fireAt: string;
  status: "pending" | "sent" | "cancelled";
  sentAt: string | null;
}

export interface SettingsDto {
  timezone: string;
  notification: {
    ddayOffsets: number[];
    reminderHour: number;
  };
  integrations: {
    telegram: { connected: boolean; userId: number };
    kakaotalk: { connected: boolean };
  };
}
