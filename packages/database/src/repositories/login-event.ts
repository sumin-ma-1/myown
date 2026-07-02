import { and, desc, eq, gt } from "drizzle-orm";
import type { Database } from "../client.js";
import { loginEvents } from "../schema.js";
import type { LoginEvent, LoginEventType } from "../schema.js";

export class LoginEventRepository {
  constructor(private readonly db: Database) {}

  async create(input: {
    webAccountId: string;
    eventType: LoginEventType;
    ip?: string;
    userAgent?: string;
  }): Promise<LoginEvent> {
    const [event] = await this.db
      .insert(loginEvents)
      .values({
        webAccountId: input.webAccountId,
        eventType: input.eventType,
        ip: input.ip,
        userAgent: input.userAgent,
      })
      .returning();
    return event;
  }

  async listRecent(limit = 100): Promise<LoginEvent[]> {
    return this.db
      .select()
      .from(loginEvents)
      .orderBy(desc(loginEvents.createdAt))
      .limit(limit);
  }

  async listByAccount(webAccountId: string, limit = 20): Promise<LoginEvent[]> {
    return this.db
      .select()
      .from(loginEvents)
      .where(eq(loginEvents.webAccountId, webAccountId))
      .orderBy(desc(loginEvents.createdAt))
      .limit(limit);
  }
}
