import { desc, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { webAccounts } from "../schema.js";
import type { AccountRole, WebAccount } from "../schema.js";

export class WebAccountRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<WebAccount | undefined> {
    const normalized = email.trim().toLowerCase();
    const [account] = await this.db
      .select()
      .from(webAccounts)
      .where(eq(webAccounts.email, normalized))
      .limit(1);
    return account;
  }

  async findById(id: string): Promise<WebAccount | undefined> {
    const [account] = await this.db
      .select()
      .from(webAccounts)
      .where(eq(webAccounts.id, id))
      .limit(1);
    return account;
  }

  async create(input: {
    email: string;
    displayName?: string;
    role?: AccountRole;
    inviteCodeId?: string;
  }): Promise<WebAccount> {
    const [account] = await this.db
      .insert(webAccounts)
      .values({
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName,
        role: input.role ?? "user",
        inviteCodeId: input.inviteCodeId,
      })
      .returning();
    return account;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db
      .update(webAccounts)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(webAccounts.id, id));
  }

  async listAll(): Promise<WebAccount[]> {
    return this.db.select().from(webAccounts).orderBy(desc(webAccounts.createdAt));
  }
}
