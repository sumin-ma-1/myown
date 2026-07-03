import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { googleCalendarConnections } from "../schema.js";
import type { GoogleCalendarConnection } from "../schema.js";

export class GoogleCalendarConnectionRepository {
  constructor(private readonly db: Database) {}

  async findByUserId(userId: string): Promise<GoogleCalendarConnection | undefined> {
    const [row] = await this.db
      .select()
      .from(googleCalendarConnections)
      .where(eq(googleCalendarConnections.userId, userId))
      .limit(1);
    return row;
  }

  async upsert(input: {
    userId: string;
    googleEmail?: string;
    refreshToken: string;
    accessToken?: string;
    accessTokenExpiresAt?: Date;
  }): Promise<GoogleCalendarConnection> {
    const existing = await this.findByUserId(input.userId);
    if (existing) {
      const [row] = await this.db
        .update(googleCalendarConnections)
        .set({
          googleEmail: input.googleEmail ?? existing.googleEmail,
          refreshToken: input.refreshToken,
          accessToken: input.accessToken ?? existing.accessToken,
          accessTokenExpiresAt: input.accessTokenExpiresAt ?? existing.accessTokenExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(googleCalendarConnections.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await this.db
      .insert(googleCalendarConnections)
      .values({
        userId: input.userId,
        googleEmail: input.googleEmail,
        refreshToken: input.refreshToken,
        accessToken: input.accessToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
      })
      .returning();
    return row;
  }

  async updateTokens(
    userId: string,
    input: { accessToken: string; accessTokenExpiresAt: Date },
  ): Promise<void> {
    await this.db
      .update(googleCalendarConnections)
      .set({
        accessToken: input.accessToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarConnections.userId, userId));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db
      .delete(googleCalendarConnections)
      .where(eq(googleCalendarConnections.userId, userId));
  }
}
