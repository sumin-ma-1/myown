import type { Task } from "@myown/database";
import { daysUntil, formatDate, formatDateTime } from "./date.js";
import { isDateOnlyDue } from "./datetime-parse.js";

function formatDueAt(dueAt: Date): string {
  return isDateOnlyDue(dueAt) ? formatDate(dueAt) : formatDateTime(dueAt);
}

const priorityEmoji: Record<Task["priority"], string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟢",
};

const priorityLabelKo: Record<Task["priority"], string> = {
  urgent: "최우선",
  high: "우선",
  medium: "계획",
};

export function formatTaskLine(task: Task): string {
  const due = task.dueAt
    ? ` | 마감: ${formatDueAt(task.dueAt)} (D${daysUntil(task.dueAt) >= 0 ? "-" : "+"}${Math.abs(daysUntil(task.dueAt))})`
    : "";
  return `${task.listIndex}. ${priorityEmoji[task.priority]} ${task.title}${due}`;
}

export function formatTaskList(tasks: Task[], title: string): string {
  if (tasks.length === 0) {
    return `${title}\n\n등록된 업무가 없습니다.`;
  }
  const lines = tasks.map(formatTaskLine);
  return `${title}\n\n${lines.join("\n")}\n\n완료: /done <번호> 또는 "N번 완료"`;
}

export function formatTaskDetail(task: Task): string {
  const parts = [
    `📌 ${task.title}`,
    task.description ? `📝 ${task.description}` : null,
    `우선순위: ${priorityLabelKo[task.priority]}`,
    task.dueAt ? `마감: ${formatDueAt(task.dueAt)}` : "마감: 없음",
    `번호: ${task.listIndex}`,
  ].filter(Boolean);
  return parts.join("\n");
}
