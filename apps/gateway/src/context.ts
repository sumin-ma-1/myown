import {
  AttachmentRepository,
  CalendarImportRepository,
  ChannelConnectionRepository,
  GoogleCalendarConnectionRepository,
  InviteCodeRepository,
  LoginEventRepository,
  ReminderRepository,
  SessionRepository,
  TaskAttachmentRepository,
  TaskRepository,
  UserNotificationRepository,
  UserRepository,
  WebAccountRepository,
  getDb,
} from "@myown/database";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { AgentRuntime } from "./agent/runtime.js";
import { config } from "./config.js";
import { AttachmentService } from "./services/attachment.js";
import { AuthService } from "./services/auth.js";
import { type ReminderJobData, createReminderQueue } from "./services/reminder-queue.js";
import { ReminderService } from "./services/reminder.js";
import { TaskService } from "./services/task.js";
import { TelegramLinkService } from "./services/telegram-link.js";
import { KakaoLinkService } from "./services/kakao-link.js";
import { GoogleCalendarService } from "./services/google-calendar.js";
import { NotificationService } from "./services/notification.js";
import { MorningBriefingService } from "./services/morning-briefing.js";
import { ChatMemoryStore } from "./services/chat-memory-store.js";

export interface AppContext {
  users: UserRepository;
  webAccounts: WebAccountRepository;
  inviteCodes: InviteCodeRepository;
  sessions: SessionRepository;
  loginEvents: LoginEventRepository;
  tasks: TaskRepository;
  reminders: ReminderRepository;
  attachments: AttachmentRepository;
  taskAttachments: TaskAttachmentRepository;
  channelConnections: ChannelConnectionRepository;
  googleCalendarConnections: GoogleCalendarConnectionRepository;
  calendarImports: CalendarImportRepository;
  userNotifications: UserNotificationRepository;
  taskService: TaskService;
  attachmentService: AttachmentService;
  reminderService: ReminderService;
  notifications: NotificationService;
  morningBriefing: MorningBriefingService;
  chatMemory: ChatMemoryStore;
  agent: AgentRuntime;
  reminderQueue: Queue<ReminderJobData>;
  redis: Redis;
  telegramLink: TelegramLinkService;
  kakaoLink: KakaoLinkService;
  googleCalendar: GoogleCalendarService;
  auth: AuthService;
}

export function createContext(redis: Redis): AppContext {
  const db = getDb(config.databaseUrl);
  const users = new UserRepository(db);
  const webAccounts = new WebAccountRepository(db);
  const inviteCodes = new InviteCodeRepository(db);
  const sessions = new SessionRepository(db);
  const loginEvents = new LoginEventRepository(db);
  const tasks = new TaskRepository(db);
  const reminders = new ReminderRepository(db);
  const attachments = new AttachmentRepository(db);
  const taskAttachments = new TaskAttachmentRepository(db);
  const channelConnections = new ChannelConnectionRepository(db);
  const googleCalendarConnections = new GoogleCalendarConnectionRepository(db);
  const calendarImports = new CalendarImportRepository(db);
  const userNotifications = new UserNotificationRepository(db);
  const reminderQueue = createReminderQueue();
  const reminderService = new ReminderService(reminders, reminderQueue);
  const taskService = new TaskService(tasks, reminderService, taskAttachments);
  const attachmentService = new AttachmentService(attachments, taskService, taskAttachments);
  const notifications = new NotificationService(userNotifications, users);
  const morningBriefing = new MorningBriefingService(users, tasks);
  const chatMemory = new ChatMemoryStore(redis);
  const agent = new AgentRuntime(taskService);
  const auth = new AuthService(redis, webAccounts, users, inviteCodes, sessions, loginEvents);
  const telegramLink = new TelegramLinkService(redis, users, channelConnections);
  const kakaoLink = new KakaoLinkService(redis, users, channelConnections);
  const googleCalendar = new GoogleCalendarService(
    redis,
    googleCalendarConnections,
    calendarImports,
    users,
    tasks,
    taskService,
    notifications,
  );

  return {
    users,
    webAccounts,
    inviteCodes,
    sessions,
    loginEvents,
    tasks,
    reminders,
    attachments,
    taskAttachments,
    channelConnections,
    googleCalendarConnections,
    calendarImports,
    userNotifications,
    taskService,
    attachmentService,
    reminderService,
    notifications,
    morningBriefing,
    chatMemory,
    agent,
    reminderQueue,
    redis,
    telegramLink,
    kakaoLink,
    googleCalendar,
    auth,
  };
}
