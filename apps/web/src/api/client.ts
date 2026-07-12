import type {
  AdminActivityDto,
  AdminInviteDto,
  AdminUserDto,
  AuthMeDto,
  ChatReplyDto,
  ComposeDraftDto,
  ExtraReminderRule,
  IntegrationDto,
  ReminderDto,
  SettingsDto,
  TaskDto,
  TaskReminderConfigDto,
  TelegramLinkDto,
  TelegramLinkStatus,
  KakaoLinkDto,
  KakaoLinkStatus,
  CalendarImportDto,
  GoogleCalendarAutoSyncSettingsDto,
  GoogleCalendarStatusDto,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData = init?.body instanceof FormData;
  if (init?.body && !isFormData) headers.set("Content-Type", "application/json");

  const res = await fetch(path, { ...init, headers, credentials: "include" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),

  getMe: () => request<AuthMeDto>("/api/auth/me"),

  validateInvite: (code: string) =>
    request<{ ok: true; allowedEmail: string; code: string }>(
      `/api/auth/invite/validate?code=${encodeURIComponent(code)}`,
    ),

  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

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

  listCalendarTasks: (from: string, to: string, options?: { includeCompleted?: boolean }) => {
    const params = new URLSearchParams({ from, to });
    if (options?.includeCompleted) params.set("includeCompleted", "true");
    return request<{ items: TaskDto[] }>(`/api/calendar?${params}`);
  },

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

  deleteTask: (id: string) =>
    request<{ ok: boolean }>(`/api/tasks/${id}`, { method: "DELETE" }),

  uploadAttachment: (taskId: string, files: File | File[]) => {
    const list = Array.isArray(files) ? files : [files];
    const form = new FormData();
    for (const file of list) form.append("file", file);
    return request<{ item: TaskDto; fileNames: string[] }>(`/api/tasks/${taskId}/attachment`, {
      method: "POST",
      body: form,
    });
  },

  removeAttachment: (taskId: string, attachmentId: string) =>
    request<{ item: TaskDto }>(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
      method: "DELETE",
    }),

  listReminders: (taskId: string) =>
    request<{ items: ReminderDto[] }>(`/api/tasks/${taskId}/reminders`),

  deleteReminder: (reminderId: string) =>
    request<{ ok: boolean }>(`/api/reminders/${reminderId}`, { method: "DELETE" }),

  downloadAttachment: async (attachmentId: string, fileName: string) => {
    const res = await fetch(`/api/attachments/${attachmentId}/download`, {
      credentials: "include",
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

  startTelegramLink: () =>
    request<TelegramLinkDto>("/api/integrations/telegram/link", { method: "POST" }),

  getTelegramLinkStatus: (token: string) =>
    request<{ status: TelegramLinkStatus; userId?: string }>(
      `/api/integrations/telegram/link/${encodeURIComponent(token)}`,
    ),

  startKakaoLink: () =>
    request<KakaoLinkDto>("/api/integrations/kakao/link", { method: "POST" }),

  getKakaoLinkStatus: (token: string) =>
    request<{ status: KakaoLinkStatus; userId?: string }>(
      `/api/integrations/kakao/link/${encodeURIComponent(token)}`,
    ),

  disconnectIntegration: (provider: IntegrationDto["provider"]) =>
    request<{ items: IntegrationDto[] }>(`/api/integrations/${provider}/disconnect`, {
      method: "POST",
    }),

  syncIntegration: (provider: IntegrationDto["provider"]) =>
    request<{ items: IntegrationDto[] }>(`/api/integrations/${provider}/sync`, {
      method: "POST",
    }),

  getGoogleCalendarStatus: () =>
    request<GoogleCalendarStatusDto>("/api/integrations/google-calendar/status"),

  updateGoogleCalendarSettings: (body: {
    autoSyncEnabled?: boolean;
    autoSyncIntervalHours?: number;
    autoSyncPastDays?: number;
    autoSyncFutureDays?: number;
  }) =>
    request<{ autoSync: GoogleCalendarAutoSyncSettingsDto }>(
      "/api/integrations/google-calendar/settings",
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    ),

  syncGoogleCalendar: (options?: { pastDays?: number; futureDays?: number }) =>
    request<{ imported: number; updated: number; pruned: number; items: CalendarImportDto[] }>(
      "/api/integrations/google-calendar/sync",
      {
        method: "POST",
        body: JSON.stringify(options ?? {}),
      },
    ),

  disconnectGoogleCalendar: () =>
    request<{ ok: boolean }>("/api/integrations/google-calendar/disconnect", {
      method: "POST",
    }),

  listGoogleCalendarImports: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return request<{ items: CalendarImportDto[] }>(
      `/api/integrations/google-calendar/imports${qs ? `?${qs}` : ""}`,
    );
  },

  setGoogleCalendarImport: (id: string, enabled: boolean) =>
    request<{ item: CalendarImportDto }>(`/api/integrations/google-calendar/imports/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),

  batchSetGoogleCalendarImports: (ids: string[], enabled: boolean) =>
    request<{ items: CalendarImportDto[] }>("/api/integrations/google-calendar/imports/batch", {
      method: "POST",
      body: JSON.stringify({ ids, enabled }),
    }),

  updateSettings: (body: {
    notification?: Partial<SettingsDto["notification"]>;
  }) =>
    request<SettingsDto>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  adminListUsers: () => request<{ items: AdminUserDto[] }>("/api/admin/users"),

  adminListInvites: () => request<{ items: AdminInviteDto[] }>("/api/admin/invites"),

  adminCreateInvite: (body: { allowedEmail: string; note?: string; expiresInDays?: number }) =>
    request<{ item: AdminInviteDto & { signupUrl: string } }>("/api/admin/invites", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  adminDeleteInvite: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/invites/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  adminListActivity: () => request<{ items: AdminActivityDto[] }>("/api/admin/activity"),

  getChatCompose: () => request<{ compose: ComposeDraftDto | null }>("/api/chat/compose"),

  sendChatMessage: (text: string) =>
    request<ChatReplyDto>("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  addChatMemo: (text: string) =>
    request<ChatReplyDto>("/api/chat/compose/memo", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  uploadChatFile: (file: File, caption?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (caption?.trim()) form.append("caption", caption.trim());
    return request<ChatReplyDto>("/api/chat/compose/files", { method: "POST", body: form });
  },

  registerChatCompose: () =>
    request<ChatReplyDto>("/api/chat/compose/register", { method: "POST" }),

  cancelChatCompose: () =>
    request<ChatReplyDto>("/api/chat/compose", { method: "DELETE" }),
};
