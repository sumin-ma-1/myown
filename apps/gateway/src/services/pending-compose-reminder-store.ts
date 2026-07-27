import type { Redis } from "ioredis";
import type { DraftReminderConfig } from "./draft-reminder.js";

const TTL_SEC = 30 * 60;
const key = (userId: string) => `pending-compose-reminder:${userId}`;

interface Stored {
  reminderConfig: DraftReminderConfig;
}

export class PendingComposeReminderStore {
  constructor(private readonly redis: Redis) {}

  async set(userId: string, reminderConfig: DraftReminderConfig): Promise<void> {
    await this.redis.set(
      key(userId),
      JSON.stringify({ reminderConfig } satisfies Stored),
      "EX",
      TTL_SEC,
    );
  }

  async take(userId: string): Promise<DraftReminderConfig | undefined> {
    const raw = await this.redis.get(key(userId));
    await this.redis.del(key(userId));
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as Stored;
      return parsed.reminderConfig;
    } catch {
      return undefined;
    }
  }

  async clear(userId: string): Promise<void> {
    await this.redis.del(key(userId));
  }
}
