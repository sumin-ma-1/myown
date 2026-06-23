import type { TaskPriority } from "./schema.js";

export const TASK_PRIORITIES = ["urgent", "high", "medium"] as const satisfies readonly TaskPriority[];

/** 레거시 `low` → `medium`(계획) */
export function normalizeTaskPriority(priority?: string | null): TaskPriority {
  if (!priority || priority === "low") return "medium";
  if (priority === "urgent" || priority === "high" || priority === "medium") {
    return priority;
  }
  return "medium";
}
