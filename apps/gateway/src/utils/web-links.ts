import { config } from "../config.js";

const DASHBOARD_LINK_LABEL = "웹 대시보드";

/** 공개 HTTPS 대시보드 URL (메뉴 버튼·바로가기용) */
export function dashboardWebLink(): string | null {
  const base = config.webAppUrl.trim().replace(/\/$/, "");
  if (!base.startsWith("https://")) return null;
  return base;
}

export function dashboardLinkLabel(): string {
  return DASHBOARD_LINK_LABEL;
}

/** 텔레그램·카카오 등에서 업무 상세로 연결하는 웹 URL */
export function taskWebLink(taskId: string): string | null {
  const base = config.taskWebUrl.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/tasks?open=${encodeURIComponent(taskId)}`;
}
