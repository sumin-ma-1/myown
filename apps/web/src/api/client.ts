import type {
  ExtraReminderRule,
  IntegrationDto,
  ReminderDto,
  SettingsDto,
  TaskDto,
  TaskReminderConfigDto,
} from "./types";

const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${API_TOKEN}`);
  const isFormData = init?.body instanceof FormData;
  if (init?.body && !isFormData) headers.set("Content-Type", "application/json");

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

  getTask: (id: string) =>
    request<{ item: TaskDto; reminderConfig: TaskReminderConfigDto }>(`/api/tasks/${id}`),

  listCalendarTasks: (from: string, to: string) =>
    request<{ items: TaskDto[] }>(
      `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),

  createTask: (body: {
    title: string;
    description?: string;
    priority?: TaskDto["priority"];
    dueAt?: string;
    workflowStatus?: TaskDto["workflowStatus"];
    useDefaultReminders?: boolean;
    extraReminders?: ExtraReminderRule[];
  }) =>
    request<{ item: TaskDto }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateTask: (
    id: string,
    body: Partial<{
      title: string;
      description: string | null;
      priority: TaskDto["priority"];
      dueAt: string | null;
      workflowStatus: TaskDto["workflowStatus"];
      status: TaskDto["status"];
      useDefaultReminders: boolean;
      extraReminders: ExtraReminderRule[];
      rescheduleReminders: boolean;
    }>,
  ) =>
    request<{ item: TaskDto }>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  uploadAttachment: (taskId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ item: TaskDto; fileName: string }>(`/api/tasks/${taskId}/attachment`, {
      method: "POST",
      body: form,
    });
  },

  listReminders: (taskId: string) =>
    request<{ items: ReminderDto[] }>(`/api/tasks/${taskId}/reminders`),

  deleteReminder: (reminderId: string) =>
    request<{ ok: boolean }>(`/api/reminders/${reminderId}`, { method: "DELETE" }),

  downloadAttachment: async (attachmentId: string, fileName: string) => {
    const res = await fetch(`/api/attachments/${attachmentId}/download`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Download failed: ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },

  getSettings: () => request<SettingsDto>("/api/settings"),

  listIntegrations: () => request<{ items: IntegrationDto[] }>("/api/integrations"),

  updateSettings: (body: {
    notification?: Partial<SettingsDto["notification"]>;
  }) =>
    request<SettingsDto>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
