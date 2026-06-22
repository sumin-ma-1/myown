import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { users } from "../schema.js";
import type { User } from "../schema.js";

export class UserRepository {
  constructor(private readonly db: Database) {}

  async findByTelegramId(telegramUserId: number): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.telegramUserId, telegramUserId))
      .limit(1);
    return user;
  }

  async upsert(telegramUserId: number, timezone = "Asia/Seoul"): Promise<User> {
    const existing = await this.findByTelegramId(telegramUserId);
    if (existing) return existing;

    const [user] = await this.db
      .insert(users)
      .values({ telegramUserId, timezone })
      .returning();
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async findFirst(): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).limit(1);
    return user;
  }

  async updatePreferences(
    userId: string,
    preferences: Record<string, unknown>,
  ): Promise<User | undefined> {
    const [user] = await this.db
      .update(users)
      .set({ preferences, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
}
