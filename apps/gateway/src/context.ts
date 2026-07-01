import {
  AttachmentRepository,
  ChannelConnectionRepository,
  ReminderRepository,
  TaskAttachmentRepository,
  TaskRepository,
  UserRepository,
  getDb,
} from "@myown/database";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { AgentRuntime } from "./agent/runtime.js";
import { config } from "./config.js";
import { AttachmentService } from "./services/attachment.js";
import { type ReminderJobData, createReminderQueue } from "./services/reminder-queue.js";
import { ReminderService } from "./services/reminder.js";
import { TaskService } from "./services/task.js";
import { TelegramLinkService } from "./services/telegram-link.js";

export interface AppContext {
  users: UserRepository;
  tasks: TaskRepository;
  reminders: ReminderRepository;
  attachments: AttachmentRepository;
  taskAttachments: TaskAttachmentRepository;
  channelConnections: ChannelConnectionRepository;
  taskService: TaskService;
  attachmentService: AttachmentService;
  reminderService: ReminderService;
  agent: AgentRuntime;
  reminderQueue: Queue<ReminderJobData>;
  redis: Redis;
  telegramLink: TelegramLinkService;
}

export function createContext(redis: Redis): AppContext {
  const db = getDb(config.databaseUrl);
  const users = new UserRepository(db);
  const tasks = new TaskRepository(db);
  const reminders = new ReminderRepository(db);
  const attachments = new AttachmentRepository(db);
  const taskAttachments = new TaskAttachmentRepository(db);
  const channelConnections = new ChannelConnectionRepository(db);
  const reminderQueue = createReminderQueue();
  const reminderService = new ReminderService(reminders, reminderQueue);
  const taskService = new TaskService(tasks, reminderService, taskAttachments);
  const attachmentService = new AttachmentService(attachments, taskService, taskAttachments);
  const agent = new AgentRuntime(taskService);
  const telegramLink = new TelegramLinkService(redis, users, channelConnections);

  return {
    users,
    tasks,
    reminders,
    attachments,
    taskAttachments,
    channelConnections,
    taskService,
    attachmentService,
    reminderService,
    agent,
    reminderQueue,
    redis,
    telegramLink,
  };
}
