import { config } from "../config.js";

/** 텔레그램·카카오 등에서 업무 상세로 연결하는 웹 URL */
export function taskWebLink(taskId: string): string | null {
  const base = config.taskWebUrl.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/tasks?open=${encodeURIComponent(taskId)}`;
}
