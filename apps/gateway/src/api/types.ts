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
    reminderHour?: number;
  };
  taskWorkflow?: Record<string, TaskWorkflowStatus>;
  taskReminderRules?: Record<string, ExtraReminderRule[]>;
  taskReminderSkipDefaults?: Record<string, boolean>;
}

export interface ExtraReminderRule {
  daysBefore?: number;
  hoursBefore?: number;
}
