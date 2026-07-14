export type TaskPriority = "urgent" | "high" | "medium";
export type TaskStatus = "active" | "completed" | "cancelled";
export type WorkflowStatus = "planned" | "in_progress";

export interface AttachmentDto {
  id: string;
  fileName: string;
  status: string;
}

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
  attachments: AttachmentDto[];
  /** 첫 번째 첨부 (하위 호환) */
  attachment: AttachmentDto | null;
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
    channels: {
      telegram: boolean;
      kakao: boolean;
    };
  };
}

export interface UserNotificationDto {
  id: string;
  type: "gcal_auto_sync" | "gcal_auth_expired" | string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface ExtraReminderRule {
  daysBefore?: number;
  hoursBefore?: number;
  minutesBefore?: number;
}

export interface TaskReminderConfigDto {
  useDefaultReminders: boolean;
  extraRules: ExtraReminderRule[];
  defaultPreview: string[];
  ddayOffsets: number[];
  reminderHour: number;
}

export interface ComposeDraftDto {
  mode: "awaiting_text" | "awaiting_attachment";
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  attachmentIds: string[];
  attachments: { id: string; fileName: string }[];
}

export interface ChatReplyDto {
  reply: string;
  compose: ComposeDraftDto | null;
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
  connectedAt: string | null;
}

export interface TelegramLinkDto {
  token: string;
  botUrl: string;
  expiresIn: number;
}

export interface KakaoLinkDto {
  token: string;
  channelUrl: string;
  linkPhrase: string;
  expiresIn: number;
}

export type TelegramLinkStatus = "pending" | "completed" | "expired" | "invalid";
export type KakaoLinkStatus = TelegramLinkStatus;

export interface CalendarImportDto {
  id: string;
  googleEventId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  enabled: boolean;
  taskId: string | null;
  htmlLink: string | null;
  lastSyncedAt: string;
}

export interface GoogleCalendarStatusDto {
  available: boolean;
  connected: boolean;
  googleEmail?: string | null;
  importCount?: number;
  enabledCount?: number;
  autoSync?: GoogleCalendarAutoSyncSettingsDto | null;
}

export interface GoogleCalendarAutoSyncSettingsDto {
  autoSyncEnabled: boolean;
  autoSyncIntervalHours: 1 | 6 | 12 | 24 | 48 | 168;
  autoSyncPastDays: number;
  autoSyncFutureDays: number;
  autoSyncActivateImports: boolean;
  lastAutoSyncedAt: string | null;
}

export interface AuthMeDto {
  authenticated: boolean;
  account?: {
    id: string;
    email: string;
    displayName: string | null;
    role: "user" | "admin";
    lastLoginAt: string | null;
    createdAt: string;
  };
  userId?: string | null;
  telegramConnected?: boolean;
}

export interface AdminUserDto {
  id: string;
  email: string;
  displayName: string | null;
  role: "user" | "admin";
  createdAt: string;
  lastLoginAt: string | null;
  inviteCode: string | null;
  telegramConnected: boolean;
  telegramDisplayName: string | null;
  userId: string | null;
  activeTaskCount: number;
}

export interface AdminInviteDto {
  id: string;
  code: string;
  allowedEmail: string;
  note: string | null;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  usedByEmail: string | null;
  createdByEmail: string | null;
  status: "available" | "used" | "expired";
}

export interface AdminActivityDto {
  id: string;
  eventType: "signup" | "login";
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}
