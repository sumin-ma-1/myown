import { Hono } from "hono";
import type { ApiEnv } from "../types.js";
import { config } from "../../config.js";
import { requireAdmin, requireAuth, sessionMiddleware } from "../middleware/session.js";

export const adminRoute = new Hono<ApiEnv>();

adminRoute.use("*", sessionMiddleware);
adminRoute.use("*", requireAuth);
adminRoute.use("*", requireAdmin);

adminRoute.get("/users", async (c) => {
  const app = c.var.app;
  const accounts = await app.webAccounts.listAll();
  const items = await Promise.all(
    accounts.map(async (account) => {
      const user = await app.users.findByWebAccountId(account.id);
      let telegramConnected = false;
      let telegramDisplayName: string | null = null;
      let taskCount = 0;

      if (user) {
        const conn = await app.channelConnections.findByUserAndProvider(user.id, "telegram");
        telegramConnected = conn?.status === "connected";
        telegramDisplayName = conn?.displayName ?? null;
        const activeTasks = await app.tasks.listActive(user.id);
        taskCount = activeTasks.length;
      }

      let inviteCode: string | null = null;
      if (account.inviteCodeId) {
        const invite = await app.inviteCodes.findById(account.inviteCodeId);
        inviteCode = invite?.code ?? null;
      }

      return {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        role: account.role,
        createdAt: account.createdAt.toISOString(),
        lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
        inviteCode,
        telegramConnected,
        telegramDisplayName,
        userId: user?.id ?? null,
        activeTaskCount: taskCount,
      };
    }),
  );

  return c.json({ items });
});

adminRoute.get("/invites", async (c) => {
  const app = c.var.app;
  const rows = await app.inviteCodes.listAll();

  const items = await Promise.all(
    rows.map(async (invite) => {
      let usedByEmail: string | null = null;
      if (invite.usedByAccountId) {
        const account = await app.webAccounts.findById(invite.usedByAccountId);
        usedByEmail = account?.email ?? null;
      }

      let createdByEmail: string | null = null;
      if (invite.createdByAccountId) {
        const account = await app.webAccounts.findById(invite.createdByAccountId);
        createdByEmail = account?.email ?? null;
      }

      const usable = app.inviteCodes.isUsable(invite);

      return {
        id: invite.id,
        code: invite.code,
        allowedEmail: invite.allowedEmail,
        note: invite.note,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt?.toISOString() ?? null,
        usedAt: invite.usedAt?.toISOString() ?? null,
        usedByEmail,
        createdByEmail,
        status: invite.usedByAccountId ? "used" : usable ? "available" : "expired",
      };
    }),
  );

  return c.json({ items });
});

adminRoute.post("/invites", async (c) => {
  const app = c.var.app;
  const webAccountId = c.get("webAccountId")!;
  const body = (await c.req.json().catch(() => ({}))) as {
    allowedEmail?: string;
    note?: string;
    expiresInDays?: number;
  };

  const allowedEmail = body.allowedEmail?.trim().toLowerCase();
  if (!allowedEmail || !allowedEmail.includes("@")) {
    return c.json({ error: "초대할 이메일을 입력해 주세요." }, 400);
  }

  const code = app.auth.generateInviteCode();
  const expiresAt =
    body.expiresInDays && body.expiresInDays > 0
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

  const invite = await app.inviteCodes.create({
    code,
    allowedEmail,
    note: body.note?.trim() || undefined,
    createdByAccountId: webAccountId,
    expiresAt,
  });

  return c.json({
    item: {
      id: invite.id,
      code: invite.code,
      allowedEmail: invite.allowedEmail,
      note: invite.note,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      signupUrl: `${config.webAppUrl}/signup?code=${encodeURIComponent(invite.code)}`,
    },
  });
});

adminRoute.get("/activity", async (c) => {
  const app = c.var.app;
  const events = await app.loginEvents.listRecent(100);

  const items = await Promise.all(
    events.map(async (event) => {
      const account = await app.webAccounts.findById(event.webAccountId);
      return {
        id: event.id,
        eventType: event.eventType,
        email: account?.email ?? null,
        ip: event.ip,
        userAgent: event.userAgent,
        createdAt: event.createdAt.toISOString(),
      };
    }),
  );

  return c.json({ items });
});
