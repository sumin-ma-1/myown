export type TaskPriority = "urgent" | "high" | "medium";
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
}

export type IntegrationStatus = "connected" | "disconnected" | "error" | "unavailable";
export type ChannelProvider = "telegram" | "kakao" | "slack";

export interface IntegrationDto {
  provider: ChannelProvider;
  name: string;
  description: string;
  available: boolean;
  status: IntegrationStatus;
  connectionId: string | null;
  displayName: string | null;
  externalId: string | null;
  connectedAt: string | null;
}
