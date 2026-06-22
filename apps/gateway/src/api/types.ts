import type { AppContext } from "../context.js";

export type ApiEnv = {
  Variables: {
    app: AppContext;
    userId: string;
  };
};

export type TaskWorkflowStatus = "planned" | "in_progress";

export interface UserPreferences {
  notification?: {
    ddayOffsets?: number[];
    reminderHour?: number;
  };
  taskWorkflow?: Record<string, TaskWorkflowStatus>;
}
