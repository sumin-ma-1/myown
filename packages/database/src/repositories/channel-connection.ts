import { and, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { isSensitiveConnectionLabel } from "../connection-privacy.js";
import { channelConnections } from "../schema.js";
import type { ChannelConnection, ChannelProvider } from "../schema.js";

export class ChannelConnectionRepository {
  constructor(private readonly db: Database) {}

  async listByUserId(userId: string): Promise<ChannelConnection[]> {
    return this.db
      .select()
      .from(channelConnections)
      .where(eq(channelConnections.userId, userId));
  }

  async findByUserAndProvider(
    userId: string,
    provider: ChannelProvider,
  ): Promise<ChannelConnection | undefined> {
    const [row] = await this.db
      .select()
      .from(channelConnections)
      .where(
        and(eq(channelConnections.userId, userId), eq(channelConnections.provider, provider)),
      )
      .limit(1);
    return row;
  }

  async ensureConnected(input: {
    userId: string;
    provider: ChannelProvider;
    externalId: string;
    displayName?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ChannelConnection> {
    const existing = await this.findByUserAndProvider(input.userId, input.provider);

    if (existing) {
      let displayName = input.displayName ?? existing.displayName ?? null;
      if (isSensitiveConnectionLabel(displayName)) {
        displayName =
          input.displayName && !isSensitiveConnectionLabel(input.displayName)
            ? input.displayName
            : null;
      }

      const [row] = await this.db
        .update(channelConnections)
        .set({
          externalId: input.externalId,
          displayName,
          metadata: input.metadata ?? existing.metadata ?? {},
          status: "connected",
          disconnectedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(channelConnections.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await this.db
      .insert(channelConnections)
      .values({
        userId: input.userId,
        provider: input.provider,
        externalId: input.externalId,
        displayName: input.displayName,
        metadata: input.metadata ?? {},
        status: "connected",
      })
      .returning();
    return row;
  }

  async ensureTelegram(
    userId: string,
    telegramUserId: number,
    displayName?: string,
  ): Promise<ChannelConnection> {
    return this.ensureConnected({
      userId,
      provider: "telegram",
      externalId: String(telegramUserId),
      displayName: displayName && !isSensitiveConnectionLabel(displayName) ? displayName : undefined,
    });
  }

  async disconnect(userId: string, provider: ChannelProvider): Promise<void> {
    await this.db
      .update(channelConnections)
      .set({
        status: "disconnected",
        disconnectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(channelConnections.userId, userId), eq(channelConnections.provider, provider)),
      );
  }
}
