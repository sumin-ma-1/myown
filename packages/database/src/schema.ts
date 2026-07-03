import {
  bigint,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const taskStatusEnum = pgEnum("task_status", [
  "active",
  "completed",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "urgent",
  "high",
  "medium",
  "low", // deprecated — DB 호환용, 앱에서는 medium으로 정규화
]);

export const reminderStatusEnum = pgEnum("reminder_status", [
  "pending",
  "sent",
  "cancelled",
]);

export const attachmentStatusEnum = pgEnum("attachment_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const channelProviderEnum = pgEnum("channel_provider", [
  "telegram",
  "kakao",
  "slack",
]);

export const channelConnectionStatusEnum = pgEnum("channel_connection_status", [
  "connected",
  "disconnected",
  "error",
]);

export const accountRoleEnum = pgEnum("account_role", ["user", "admin"]);

export const loginEventTypeEnum = pgEnum("login_event_type", ["signup", "login"]);

export const webAccounts = pgTable("web_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  role: accountRoleEnum("role").notNull().default("user"),
  inviteCodeId: uuid("invite_code_id"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inviteCodes = pgTable(
  "invite_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    allowedEmail: text("allowed_email").notNull(),
    note: text("note"),
    createdByAccountId: uuid("created_by_account_id").references(() => webAccounts.id, {
      onDelete: "set null",
    }),
    usedByAccountId: uuid("used_by_account_id").references(() => webAccounts.id, {
      onDelete: "set null",
    }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("invite_codes_used_by_idx").on(table.usedByAccountId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webAccountId: uuid("web_account_id")
      .notNull()
      .references(() => webAccounts.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_account_id_idx").on(table.webAccountId)],
);

export const loginEvents = pgTable(
  "login_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webAccountId: uuid("web_account_id")
      .notNull()
      .references(() => webAccounts.id, { onDelete: "cascade" }),
    eventType: loginEventTypeEnum("event_type").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("login_events_account_id_idx").on(table.webAccountId)],
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  webAccountId: uuid("web_account_id")
    .references(() => webAccounts.id, { onDelete: "cascade" })
    .unique(),
  telegramUserId: bigint("telegram_user_id", { mode: "number" }).unique(),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const channelConnections = pgTable(
  "channel_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: channelProviderEnum("provider").notNull(),
    externalId: text("external_id").notNull(),
    displayName: text("display_name"),
    status: channelConnectionStatusEnum("status").notNull().default("connected"),
    credentials: jsonb("credentials").$type<Record<string, unknown>>().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("channel_connections_user_id_idx").on(table.userId),
    index("channel_connections_provider_external_idx").on(table.provider, table.externalId),
    uniqueIndex("channel_connections_user_provider_uidx").on(table.userId, table.provider),
  ],
);

export const googleCalendarConnections = pgTable(
  "google_calendar_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    googleEmail: text("google_email"),
    refreshToken: text("refresh_token").notNull(),
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("google_calendar_connections_user_id_idx").on(table.userId)],
);

export const calendarImports = pgTable(
  "calendar_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    googleEventId: text("google_event_id").notNull(),
    googleCalendarId: text("google_calendar_id").notNull().default("primary"),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    enabled: boolean("enabled").notNull().default(false),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    htmlLink: text("html_link"),
    etag: text("etag"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("calendar_imports_user_event_uidx").on(table.userId, table.googleEventId),
    index("calendar_imports_user_id_idx").on(table.userId),
    index("calendar_imports_starts_at_idx").on(table.startsAt),
    index("calendar_imports_enabled_idx").on(table.userId, table.enabled),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    fileSize: bigint("file_size", { mode: "number" }),
    storagePath: text("storage_path").notNull(),
    telegramFileId: text("telegram_file_id"),
    extractedText: text("extracted_text"),
    summary: text("summary"),
    keywords: jsonb("keywords").$type<string[]>().default([]),
    status: attachmentStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("attachments_user_id_idx").on(table.userId)],
);

export const taskAttachments = pgTable(
  "task_attachments",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    attachmentId: uuid("attachment_id")
      .notNull()
      .references(() => attachments.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("task_attachments_task_attachment_uidx").on(table.taskId, table.attachmentId),
    index("task_attachments_task_id_idx").on(table.taskId),
    index("task_attachments_attachment_id_idx").on(table.attachmentId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("active"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    attachmentId: uuid("attachment_id").references(() => attachments.id, {
      onDelete: "set null",
    }),
    listIndex: bigint("list_index", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tasks_user_status_idx").on(table.userId, table.status),
    index("tasks_due_at_idx").on(table.dueAt),
  ],
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
    status: reminderStatusEnum("status").notNull().default("pending"),
    jobId: text("job_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reminders_fire_at_status_idx").on(table.fireAt, table.status),
    index("reminders_task_id_idx").on(table.taskId),
  ],
);

export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];
export type TaskPriority = (typeof taskPriorityEnum.enumValues)[number];
export type ReminderStatus = (typeof reminderStatusEnum.enumValues)[number];
export type ChannelProvider = (typeof channelProviderEnum.enumValues)[number];
export type ChannelConnectionStatus = (typeof channelConnectionStatusEnum.enumValues)[number];

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type AttachmentStatus = (typeof attachmentStatusEnum.enumValues)[number];
export type ChannelConnection = typeof channelConnections.$inferSelect;
export type NewChannelConnection = typeof channelConnections.$inferInsert;
export type GoogleCalendarConnection = typeof googleCalendarConnections.$inferSelect;
export type NewGoogleCalendarConnection = typeof googleCalendarConnections.$inferInsert;
export type CalendarImport = typeof calendarImports.$inferSelect;
export type NewCalendarImport = typeof calendarImports.$inferInsert;
export type WebAccount = typeof webAccounts.$inferSelect;
export type NewWebAccount = typeof webAccounts.$inferInsert;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type NewInviteCode = typeof inviteCodes.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type LoginEvent = typeof loginEvents.$inferSelect;
export type AccountRole = (typeof accountRoleEnum.enumValues)[number];
export type LoginEventType = (typeof loginEventTypeEnum.enumValues)[number];
