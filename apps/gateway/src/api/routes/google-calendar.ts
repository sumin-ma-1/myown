import { Hono } from "hono";
import type { ApiEnv } from "../types.js";
import { config } from "../../config.js";
import { requireAppUser } from "../middleware/session.js";
import { GoogleCalendarService } from "../../services/google-calendar.js";

export const googleCalendarRoute = new Hono<ApiEnv>();

googleCalendarRoute.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const oauthError = c.req.query("error");

  if (oauthError || !code || !state) {
    return c.redirect(
      `${config.webAppUrl}/integrations?gcal_error=${encodeURIComponent("Google Calendar 연결이 취소되었습니다.")}`,
    );
  }

  try {
    const result = await c.get("app").googleCalendar.completeConnect(code, state);
    if (!result.ok) {
      return c.redirect(
        `${config.webAppUrl}/integrations?gcal_error=${encodeURIComponent(result.message)}`,
      );
    }
    return c.redirect(`${config.webAppUrl}/integrations?gcal_connected=1`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google Calendar 연결에 실패했습니다.";
    return c.redirect(
      `${config.webAppUrl}/integrations?gcal_error=${encodeURIComponent(message)}`,
    );
  }
});

googleCalendarRoute.use("*", requireAppUser);

googleCalendarRoute.get("/status", async (c) => {
  const userId = c.get("userId")!;
  if (!GoogleCalendarService.isAvailable()) {
    return c.json({ available: false, connected: false });
  }
  const status = await c.get("app").googleCalendar.getStatus(userId);
  return c.json({ available: true, ...status });
});

googleCalendarRoute.get("/connect", async (c) => {
  const userId = c.get("userId")!;
  const webAccountId = c.get("webAccountId")!;
  try {
    const url = await c.get("app").googleCalendar.beginConnect(userId, webAccountId);
    return c.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "연결을 시작하지 못했습니다.";
    return c.redirect(
      `${config.webAppUrl}/integrations?gcal_error=${encodeURIComponent(message)}`,
    );
  }
});

googleCalendarRoute.post("/disconnect", async (c) => {
  const userId = c.get("userId")!;
  await c.get("app").googleCalendar.disconnect(userId);
  return c.json({ ok: true });
});

googleCalendarRoute.post("/sync", async (c) => {
  const userId = c.get("userId")!;
  const body = await c.req.json<{ pastDays?: number; futureDays?: number }>().catch(() => ({}));
  try {
    const result = await c.get("app").googleCalendar.sync(userId, {
      pastDays: body.pastDays,
      futureDays: body.futureDays,
    });
    const items = await c.get("app").googleCalendar.listImports(userId);
    return c.json({ ...result, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "동기화에 실패했습니다.";
    return c.json({ error: message }, 500);
  }
});

googleCalendarRoute.get("/imports", async (c) => {
  const userId = c.get("userId")!;
  const from = c.req.query("from") ?? undefined;
  const to = c.req.query("to") ?? undefined;
  const items = await c.get("app").googleCalendar.listImports(userId, { from, to });
  return c.json({ items });
});

googleCalendarRoute.patch("/imports/:id", async (c) => {
  const userId = c.get("userId")!;
  const importId = c.req.param("id");
  const body = await c.req.json<{ enabled?: boolean }>();

  if (typeof body.enabled !== "boolean") {
    return c.json({ error: "enabled(boolean)가 필요합니다." }, 400);
  }

  try {
    const item = await c.get("app").googleCalendar.setImportEnabled(
      userId,
      importId,
      body.enabled,
    );
    return c.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : "상태 변경에 실패했습니다.";
    return c.json({ error: message }, 400);
  }
});

googleCalendarRoute.post("/imports/batch", async (c) => {
  const userId = c.get("userId")!;
  const body = await c.req.json<{ ids?: string[]; enabled?: boolean }>();

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return c.json({ error: "ids 배열이 필요합니다." }, 400);
  }
  if (typeof body.enabled !== "boolean") {
    return c.json({ error: "enabled(boolean)가 필요합니다." }, 400);
  }

  try {
    const items = await c.get("app").googleCalendar.setImportsEnabled(
      userId,
      body.ids,
      body.enabled,
    );
    return c.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "일괄 변경에 실패했습니다.";
    return c.json({ error: message }, 400);
  }
});
