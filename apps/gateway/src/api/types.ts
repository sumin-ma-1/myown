import type { AppContext } from "../context.js";

export type ApiEnv = {
  Variables: {
    app: AppContext;
    userId: string | null;
    webAccountId: string | null;
    isAdmin: boolean;
    email: string | null;
  };
};

export type TaskWorkflowStatus = "planned" | "in_progress";

export interface UserPreferences {
  notification?: {
    ddayOffsets?: number[];
    ddayEnabled?: boolean;
    reminderHour?: number;
    morningBriefing?: {
      enabled?: boolean;
      hour?: number;
      minute?: number;
      /** ISO datetime (or legacy YYYY-MM-DD) — last successful send */
      lastSentDate?: string;
    };
    channels?: {
      telegram?: boolean;
      kakao?: boolean;
    };
  };
  taskWorkflow?: Record<string, TaskWorkflowStatus>;
  taskReminderRules?: Record<string, ExtraReminderRule[]>;
  taskReminderSkipDefaults?: Record<string, boolean>;
  /** 사용자가 개별 취소한 알림 시각 (taskId → fireAt ms) */
  taskReminderSuppressedAt?: Record<string, number[]>;
  googleCalendar?: {
    email?: string | null;
  };
}

export interface ExtraReminderRule {
  daysBefore?: number;
  hoursBefore?: number;
  minutesBefore?: number;
}
