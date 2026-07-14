import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import { userNotifications } from "../schema.js";
import type { UserNotification, UserNotificationType } from "../schema.js";

export class UserNotificationRepository {
  constructor(private readonly db: Database) {}

  async create(input: {
    userId: string;
    type: UserNotificationType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }): Promise<UserNotification> {
    const [row] = await this.db
      .insert(userNotifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload ?? {},
      })
      .returning();
    return row;
  }

  async listByUserId(
    userId: string,
    options?: { limit?: number },
  ): Promise<UserNotification[]> {
    const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
    return this.db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt))
      .limit(limit);
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userNotifications)
      .where(and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt)));
    return Number(row?.count ?? 0);
  }

  async markRead(userId: string, id: string): Promise<UserNotification | undefined> {
    const [row] = await this.db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, id),
          eq(userNotifications.userId, userId),
          isNull(userNotifications.readAt),
        ),
      )
      .returning();
    return row;
  }

  async markAllRead(userId: string): Promise<number> {
    const rows = await this.db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt)))
      .returning({ id: userNotifications.id });
    return rows.length;
  }

  async hasRecentUnreadOfType(
    userId: string,
    type: UserNotificationType,
    withinMs: number,
  ): Promise<boolean> {
    const since = new Date(Date.now() - withinMs);
    const [row] = await this.db
      .select({ id: userNotifications.id })
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.type, type),
          isNull(userNotifications.readAt),
          gte(userNotifications.createdAt, since),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}
