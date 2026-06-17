import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";

export const REMINDER_QUEUE_NAME = "reminders";

export interface ReminderJobData {
  reminderId: string;
  taskId: string;
  userId: string;
  telegramUserId: number;
}

export function createRedisConnection() {
  return new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
}

export function createReminderQueue(connection: IORedis) {
  return new Queue<ReminderJobData>(REMINDER_QUEUE_NAME, { connection });
}

export function createReminderWorker(
  connection: IORedis,
  handler: (job: Job<ReminderJobData>) => Promise<void>,
) {
  return new Worker<ReminderJobData>(REMINDER_QUEUE_NAME, handler, { connection });
}

export async function scheduleReminderJob(
  queue: Queue<ReminderJobData>,
  data: ReminderJobData,
  fireAt: Date,
): Promise<string> {
  const delay = Math.max(0, fireAt.getTime() - Date.now());
  const job = await queue.add(`reminder:${data.reminderId}`, data, {
    jobId: data.reminderId,
    delay,
    removeOnComplete: true,
    removeOnFail: 100,
  });
  return job.id ?? data.reminderId;
}

export async function cancelReminderJob(
  queue: Queue<ReminderJobData>,
  jobId: string,
): Promise<void> {
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
  }
}
