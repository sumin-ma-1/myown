import { eq, isNotNull } from "drizzle-orm";
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

  async findByWebAccountId(webAccountId: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.webAccountId, webAccountId))
      .limit(1);
    return user;
  }

  async upsert(telegramUserId: number, timezone = "Asia/Seoul"): Promise<User> {
    const existing = await this.findByTelegramId(telegramUserId);
    if (existing) {
      const [user] = await this.db
        .update(users)
        .set({ updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning();
      return user;
    }

    const [user] = await this.db
      .insert(users)
      .values({ telegramUserId, timezone })
      .returning();
    return user;
  }

  async createForWebAccount(webAccountId: string, timezone = "Asia/Seoul"): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values({ webAccountId, timezone })
      .returning();
    return user;
  }

  async attachWebAccount(userId: string, webAccountId: string): Promise<User | undefined> {
    const [user] = await this.db
      .update(users)
      .set({ webAccountId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deleteById(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }

  async linkTelegram(userId: string, telegramUserId: number): Promise<User | undefined> {
    const [user] = await this.db
      .update(users)
      .set({ telegramUserId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async listWithTelegram(): Promise<User[]> {
    return this.db.select().from(users).where(isNotNull(users.telegramUserId));
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
