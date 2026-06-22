import type { ReminderDto, SettingsDto, TaskDto } from "./types";

const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${API_TOKEN}`);
  if (init?.body) headers.set("Content-Type", "application/json");

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),

  listTasks: (params?: { sort?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.sort) q.set("sort", params.sort);
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return request<{ items: TaskDto[] }>(`/api/tasks${qs ? `?${qs}` : ""}`);
  },

  listTodayTasks: () => request<{ items: TaskDto[] }>("/api/tasks/today"),

  listCalendarTasks: (from: string, to: string) =>
    request<{ items: TaskDto[] }>(
      `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),

  createTask: (body: { title: string; priority?: TaskDto["priority"]; dueAt?: string }) =>
    request<{ item: TaskDto }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateTask: (
    id: string,
    body: Partial<{
      priority: TaskDto["priority"];
      workflowStatus: TaskDto["workflowStatus"];
      status: TaskDto["status"];
    }>,
  ) =>
    request<{ item: TaskDto }>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  listReminders: (taskId: string) =>
    request<{ items: ReminderDto[] }>(`/api/tasks/${taskId}/reminders`),

  getSettings: () => request<SettingsDto>("/api/settings"),

  updateSettings: (body: {
    notification?: Partial<SettingsDto["notification"]>;
  }) =>
    request<SettingsDto>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
