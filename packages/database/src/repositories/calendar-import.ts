import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { Database } from "../client.js";
import { calendarImports } from "../schema.js";
import type { CalendarImport } from "../schema.js";

export class CalendarImportRepository {
  constructor(private readonly db: Database) {}

  async findById(userId: string, id: string): Promise<CalendarImport | undefined> {
    const [row] = await this.db
      .select()
      .from(calendarImports)
      .where(and(eq(calendarImports.userId, userId), eq(calendarImports.id, id)))
      .limit(1);
    return row;
  }

  async findByGoogleEventId(
    userId: string,
    googleEventId: string,
  ): Promise<CalendarImport | undefined> {
    const [row] = await this.db
      .select()
      .from(calendarImports)
      .where(
        and(eq(calendarImports.userId, userId), eq(calendarImports.googleEventId, googleEventId)),
      )
      .limit(1);
    return row;
  }

  async listByUserId(
    userId: string,
    options?: { from?: Date; to?: Date; enabledOnly?: boolean },
  ): Promise<CalendarImport[]> {
    const conditions = [eq(calendarImports.userId, userId)];
    if (options?.from) {
      conditions.push(gte(calendarImports.startsAt, options.from));
    }
    if (options?.to) {
      conditions.push(lte(calendarImports.startsAt, options.to));
    }
    if (options?.enabledOnly) {
      conditions.push(eq(calendarImports.enabled, true));
    }

    return this.db
      .select()
      .from(calendarImports)
      .where(and(...conditions))
      .orderBy(asc(calendarImports.startsAt));
  }

  async upsertFromGoogle(input: {
    userId: string;
    googleEventId: string;
    googleCalendarId: string;
    title: string;
    description?: string | null;
    startsAt: Date;
    endsAt?: Date | null;
    allDay: boolean;
    htmlLink?: string | null;
    etag?: string | null;
  }): Promise<CalendarImport> {
    const existing = await this.findByGoogleEventId(input.userId, input.googleEventId);
    const now = new Date();

    if (existing) {
      const [row] = await this.db
        .update(calendarImports)
        .set({
          title: input.title,
          description: input.description ?? null,
          startsAt: input.startsAt,
          endsAt: input.endsAt ?? null,
          allDay: input.allDay,
          htmlLink: input.htmlLink ?? null,
          etag: input.etag ?? null,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(calendarImports.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await this.db
      .insert(calendarImports)
      .values({
        userId: input.userId,
        googleEventId: input.googleEventId,
        googleCalendarId: input.googleCalendarId,
        title: input.title,
        description: input.description ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        allDay: input.allDay,
        enabled: false,
        htmlLink: input.htmlLink ?? null,
        etag: input.etag ?? null,
        lastSyncedAt: now,
      })
      .returning();
    return row;
  }

  async setEnabled(
    userId: string,
    id: string,
    enabled: boolean,
    taskId?: string | null,
  ): Promise<CalendarImport | undefined> {
    const [row] = await this.db
      .update(calendarImports)
      .set({
        enabled,
        taskId: taskId === undefined ? undefined : taskId,
        updatedAt: new Date(),
      })
      .where(and(eq(calendarImports.userId, userId), eq(calendarImports.id, id)))
      .returning();
    return row;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.delete(calendarImports).where(eq(calendarImports.userId, userId));
  }
}
