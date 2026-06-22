import type { Attachment, Reminder, Task, User } from "@myown/database";
import type { TaskWorkflowStatus, UserPreferences } from "../types.js";

export interface TaskDto {
  id: string;
  listIndex: number;
  title: string;
  description: string | null;
  status: Task["status"];
  workflowStatus: TaskWorkflowStatus;
  priority: Task["priority"];
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachment: {
    id: string;
    fileName: string;
    status: Attachment["status"];
  } | null;
  reminderSummary: {
    pending: number;
    sent: number;
    nextFireAt: string | null;
  };
  dday: number | null;
}

function getWorkflowStatus(
  user: User,
  task: Task,
): TaskWorkflowStatus {
  const prefs = (user.preferences ?? {}) as UserPreferences;
  if (task.status === "completed") return "in_progress";
  return prefs.taskWorkflow?.[task.id] ?? "in_progress";
}

export function serializeTask(
  task: Task,
  user: User,
  attachment?: Attachment,
  reminders: Reminder[] = [],
): TaskDto {
  const pending = reminders.filter((r) => r.status === "pending");
  const sent = reminders.filter((r) => r.status === "sent");
  const next = pending.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())[0];

  let dday: number | null = null;
  if (task.dueAt && task.status === "active") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueAt);
    due.setHours(0, 0, 0, 0);
    dday = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  }

  return {
    id: task.id,
    listIndex: task.listIndex,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    workflowStatus: task.status === "completed" ? "in_progress" : getWorkflowStatus(user, task),
    priority: task.priority,
    dueAt: task.dueAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    attachment: attachment
      ? { id: attachment.id, fileName: attachment.fileName, status: attachment.status }
      : null,
    reminderSummary: {
      pending: pending.length,
      sent: sent.length,
      nextFireAt: next?.fireAt.toISOString() ?? null,
    },
    dday,
  };
}
