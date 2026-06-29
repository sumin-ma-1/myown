import type { Task } from "@myown/database";

/** 활성 목록에서 1부터 매기는 표시 순번 (list_index와 무관) */
export function displayOrderOf(tasks: Task[], taskId: string): number | undefined {
  const index = tasks.findIndex((t) => t.id === taskId);
  return index >= 0 ? index + 1 : undefined;
}

export function resolveByDisplayOrder(tasks: Task[], order: number): Task | undefined {
  if (order >= 1 && order <= tasks.length) {
    return tasks[order - 1];
  }
  return undefined;
}

export function formatActiveTasksHint(tasks: Task[], max = 8): string {
  if (tasks.length === 0) {
    return "활성 업무가 없습니다. /add 로 등록해 주세요.";
  }
  const lines = tasks.slice(0, max).map((task, i) => `${i + 1}. ${task.title}`);
  const suffix = tasks.length > max ? `\n… 외 ${tasks.length - max}건` : "";
  return [`활성 업무 (/list):`, ...lines].join("\n") + suffix;
}
