import type { Task } from "@myown/database";
import { formatDate, formatDateTime } from "./date.js";
import { isDateOnlyDue } from "./datetime-parse.js";

const GREETINGS = [
  "좋은 아침이에요. 오늘도 잘 보내세요.",
  "상쾌한 아침이에요. 오늘 하루도 응원해요.",
  "오늘도 잘 해내실 거예요.",
  "좋은 하루 되세요.",
];

function formatDueAt(dueAt: Date): string {
  return isDateOnlyDue(dueAt) ? formatDate(dueAt) : formatDateTime(dueAt);
}

const priorityEmoji: Record<Task["priority"], string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟢",
  low: "🟢",
};

function formatBriefingTaskLine(task: Task, index: number): string {
  const due = task.dueAt ? ` | 마감: ${formatDueAt(task.dueAt)}` : "";
  return `${index}. ${priorityEmoji[task.priority]} ${task.title}${due}`;
}

export function pickMorningGreeting(date = new Date()): string {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  return GREETINGS[dayOfYear % GREETINGS.length]!;
}

export function formatMorningBriefing(tasks: Task[], date = new Date()): string {
  const greeting = pickMorningGreeting(date);
  const lines = [greeting, ""];

  if (tasks.length === 0) {
    lines.push("📅 오늘 마감 업무가 없어요.");
    return lines.join("\n");
  }

  lines.push(`📅 오늘 마감 (${tasks.length}건)`);
  tasks.forEach((task, index) => {
    lines.push(formatBriefingTaskLine(task, index + 1));
  });

  return lines.join("\n");
}

export function sortTasksForBriefing(tasks: Task[]): Task[] {
  const priorityRank: Record<Task["priority"], number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...tasks].sort((a, b) => {
    const rank = priorityRank[a.priority] - priorityRank[b.priority];
    if (rank !== 0) return rank;
    if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return a.title.localeCompare(b.title, "ko");
  });
}
