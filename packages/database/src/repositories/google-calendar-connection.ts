import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { googleCalendarConnections } from "../schema.js";
import type { GoogleCalendarConnection } from "../schema.js";

export interface GoogleCalendarAutoSyncSettings {
  autoSyncEnabled: boolean;
  autoSyncIntervalHours: number;
  autoSyncPastDays: number;
  autoSyncFutureDays: number;
}

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

  async clearAccessTokens(userId: string): Promise<void> {
    await this.db
      .update(googleCalendarConnections)
      .set({
        accessToken: null,
        accessTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarConnections.userId, userId));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db
      .delete(googleCalendarConnections)
      .where(eq(googleCalendarConnections.userId, userId));
  }

  async updateAutoSyncSettings(
    userId: string,
    settings: GoogleCalendarAutoSyncSettings,
  ): Promise<GoogleCalendarConnection | undefined> {
    const [row] = await this.db
      .update(googleCalendarConnections)
      .set({
        autoSyncEnabled: settings.autoSyncEnabled,
        autoSyncIntervalHours: settings.autoSyncIntervalHours,
        autoSyncPastDays: settings.autoSyncPastDays,
        autoSyncFutureDays: settings.autoSyncFutureDays,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarConnections.userId, userId))
      .returning();
    return row;
  }

  async markAutoSynced(userId: string, at = new Date()): Promise<void> {
    await this.db
      .update(googleCalendarConnections)
      .set({
        lastAutoSyncedAt: at,
        updatedAt: at,
      })
      .where(eq(googleCalendarConnections.userId, userId));
  }

  async listAutoSyncEnabled(): Promise<GoogleCalendarConnection[]> {
    return this.db
      .select()
      .from(googleCalendarConnections)
      .where(eq(googleCalendarConnections.autoSyncEnabled, true));
  }
}
