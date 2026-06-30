import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";

export const REMINDER_QUEUE_NAME = "reminders";

export interface ReminderJobData {
  reminderId: string;
  taskId: string;
  userId: string;
  telegramUserId: number;
}

/** BullMQ가 내부에서 ioredis를 생성할 때 쓰는 연결 설정 */
export function bullMqConnectionOptions(): ConnectionOptions {
  return {
    url: config.redisUrl,
    maxRetriesPerRequest: null,
  };
}

export function createRedisConnection(): Redis {
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null });
}

export function createReminderQueue() {
  return new Queue<ReminderJobData>(REMINDER_QUEUE_NAME, {
    connection: bullMqConnectionOptions(),
  });
}

export function createReminderWorker(
  handler: (job: Job<ReminderJobData>) => Promise<void>,
) {
  return new Worker<ReminderJobData>(REMINDER_QUEUE_NAME, handler, {
    connection: bullMqConnectionOptions(),
  });
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
