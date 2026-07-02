import { and, desc, eq, isNull, or, gt, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import { inviteCodes } from "../schema.js";
import type { InviteCode } from "../schema.js";

export class InviteCodeRepository {
  constructor(private readonly db: Database) {}

  async findByCode(code: string): Promise<InviteCode | undefined> {
    const normalized = code.trim().toUpperCase();
    const [row] = await this.db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, normalized))
      .limit(1);
    return row;
  }

  async findById(id: string): Promise<InviteCode | undefined> {
    const [row] = await this.db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.id, id))
      .limit(1);
    return row;
  }

  isUsable(invite: InviteCode): boolean {
    if (invite.usedByAccountId) return false;
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return false;
    return true;
  }

  async create(input: {
    code: string;
    allowedEmail: string;
    note?: string;
    createdByAccountId?: string;
    expiresAt?: Date;
  }): Promise<InviteCode> {
    const [row] = await this.db
      .insert(inviteCodes)
      .values({
        code: input.code.trim().toUpperCase(),
        allowedEmail: input.allowedEmail.trim().toLowerCase(),
        note: input.note,
        createdByAccountId: input.createdByAccountId,
        expiresAt: input.expiresAt,
      })
      .returning();
    return row;
  }

  async markUsed(id: string, usedByAccountId: string): Promise<InviteCode | undefined> {
    const [row] = await this.db
      .update(inviteCodes)
      .set({ usedByAccountId, usedAt: new Date() })
      .where(and(eq(inviteCodes.id, id), isNull(inviteCodes.usedByAccountId)))
      .returning();
    return row;
  }

  async listAll(): Promise<InviteCode[]> {
    return this.db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt));
  }

  async countUnused(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(inviteCodes)
      .where(
        and(
          isNull(inviteCodes.usedByAccountId),
          or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, new Date())),
        ),
      );
    return row?.count ?? 0;
  }
}
