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
}
