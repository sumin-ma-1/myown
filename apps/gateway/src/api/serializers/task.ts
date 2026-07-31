import type { Attachment, Reminder, Task, User } from "@myown/database";
import type { TaskWorkflowStatus, UserPreferences } from "../types.js";
import { formatRecurrenceLabel } from "../../utils/recurrence.js";

export interface AttachmentDto {
  id: string;
  fileName: string;
  status: Attachment["status"];
}

export interface TaskDto {
  id: string;
  listIndex: number;
  title: string;
  description: string | null;
  status: Task["status"];
  workflowStatus: TaskWorkflowStatus;
  priority: Task["priority"];
  dueAt: string | null;
  startsAt: string | null;
  allDay: boolean;
  recurrenceRule: string | null;
  recurrenceUntil: string | null;
  recurrenceCount: number | null;
  recurrenceTimezone: string | null;
  recurrenceLabel: string | null;
  /** Virtual occurrence id (`taskId::iso`) when expanded from a series */
  occurrenceKey: string | null;
  seriesId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentDto[];
  /** @deprecated 첫 번째 첨부 (하위 호환) */
  attachment: AttachmentDto | null;
  reminderSummary: {
    pending: number;
    sent: number;
    nextFireAt: string | null;
  };
  dday: number | null;
}

function toAttachmentDto(attachment: Attachment): AttachmentDto {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    status: attachment.status,
  };
}

function getWorkflowStatus(
  user: User,
  task: Task,
): TaskWorkflowStatus {
  const prefs = (user.preferences ?? {}) as UserPreferences;
  if (task.status === "completed") return "in_progress";
  return prefs.taskWorkflow?.[task.id] ?? "planned";
}

export function serializeTask(
  task: Task,
  user: User,
  attachments: Attachment[] = [],
  reminders: Reminder[] = [],
  occurrence?: {
    occurrenceStartsAt: Date;
    startsAt: Date | null;
    dueAt: Date;
    title?: string | null;
    status?: Task["status"];
  },
): TaskDto {
  const pending = reminders.filter((r) => r.status === "pending");
  const sent = reminders.filter((r) => r.status === "sent");
  const next = pending.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())[0];

  const dueAt = occurrence?.dueAt ?? task.dueAt;
  const startsAt = occurrence ? occurrence.startsAt : task.startsAt;
  const title = occurrence?.title ?? task.title;
  const status = occurrence?.status ?? task.status;

  let dday: number | null = null;
  if (dueAt && status === "active") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueAt);
    due.setHours(0, 0, 0, 0);
    dday = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  }

  const attachmentDtos = attachments.map(toAttachmentDto);
  const occurrenceKey = occurrence?.occurrenceStartsAt.toISOString() ?? null;
  const isOccurrence = Boolean(occurrence);

  return {
    id: isOccurrence && occurrence
      ? `${task.id}::${occurrence.occurrenceStartsAt.toISOString()}`
      : task.id,
    listIndex: task.listIndex,
    title,
    description: task.description ?? null,
    status,
    workflowStatus: status === "completed" ? "in_progress" : getWorkflowStatus(user, task),
    priority: task.priority,
    dueAt: dueAt?.toISOString() ?? null,
    startsAt: startsAt?.toISOString() ?? null,
    allDay: task.allDay,
    recurrenceRule: task.recurrenceRule ?? null,
    recurrenceUntil: task.recurrenceUntil?.toISOString() ?? null,
    recurrenceCount: task.recurrenceCount ?? null,
    recurrenceTimezone: task.recurrenceTimezone ?? null,
    recurrenceLabel: formatRecurrenceLabel(task.recurrenceRule),
    occurrenceKey,
    seriesId: isOccurrence ? task.id : task.recurrenceRule ? task.id : null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    attachments: attachmentDtos,
    attachment: attachmentDtos[0] ?? null,
    reminderSummary: {
      pending: pending.length,
      sent: sent.length,
      nextFireAt: next?.fireAt.toISOString() ?? null,
    },
    dday,
  };
}
