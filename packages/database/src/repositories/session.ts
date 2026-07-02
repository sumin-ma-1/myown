import { and, eq, gt } from "drizzle-orm";
import type { Database } from "../client.js";
import { sessions } from "../schema.js";
import type { Session } from "../schema.js";

export class SessionRepository {
  constructor(private readonly db: Database) {}

  async create(webAccountId: string, expiresAt: Date): Promise<Session> {
    const [session] = await this.db
      .insert(sessions)
      .values({ webAccountId, expiresAt })
      .returning();
    return session;
  }

  async findValid(id: string): Promise<Session | undefined> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
      .limit(1);
    return session;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }
}
