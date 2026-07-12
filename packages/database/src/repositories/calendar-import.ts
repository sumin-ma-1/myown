import { and, asc, eq, gt, gte, lt, lte, or } from "drizzle-orm";
import type { Database } from "../client.js";
import { calendarImports } from "../schema.js";
import type { CalendarImport } from "../schema.js";

type GoogleImportPayload = {
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  allDay: boolean;
  htmlLink?: string | null;
  etag?: string | null;
};

export type GoogleImportUpsertOutcome = "inserted" | "updated" | "unchanged";

function googleImportChanged(existing: CalendarImport, input: GoogleImportPayload): boolean {
  if (existing.etag && input.etag && existing.etag === input.etag) {
    return false;
  }

  if (existing.title !== input.title) return true;
  if ((existing.description ?? null) !== (input.description ?? null)) return true;
  if (existing.allDay !== input.allDay) return true;
  if (existing.startsAt.getTime() !== input.startsAt.getTime()) return true;

  const existingEnds = existing.endsAt?.getTime() ?? null;
  const inputEnds = input.endsAt?.getTime() ?? null;
  if (existingEnds !== inputEnds) return true;

  if ((existing.htmlLink ?? null) !== (input.htmlLink ?? null)) return true;
  if ((existing.etag ?? null) !== (input.etag ?? null)) return true;

  return false;
}

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
  } & GoogleImportPayload): Promise<{
    row: CalendarImport;
    outcome: GoogleImportUpsertOutcome;
  }> {
    const existing = await this.findByGoogleEventId(input.userId, input.googleEventId);
    const now = new Date();

    if (existing) {
      if (!googleImportChanged(existing, input)) {
        return { row: existing, outcome: "unchanged" };
      }

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
      return { row, outcome: "updated" };
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
    return { row, outcome: "inserted" };
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

  async deletePendingOutsideRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const rows = await this.db
      .delete(calendarImports)
      .where(
        and(
          eq(calendarImports.userId, userId),
          eq(calendarImports.enabled, false),
          or(lt(calendarImports.startsAt, from), gt(calendarImports.startsAt, to)),
        ),
      )
      .returning({ id: calendarImports.id });
    return rows.length;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.delete(calendarImports).where(eq(calendarImports.userId, userId));
  }
}
