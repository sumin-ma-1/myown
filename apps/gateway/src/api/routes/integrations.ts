import { Hono } from "hono";
import type { ChannelProvider } from "@myown/database";
import type { ApiEnv } from "../types.js";
import { requireAppUser } from "../middleware/session.js";
import { buildIntegrationList } from "../../integrations/catalog.js";

export const integrationsRoute = new Hono<ApiEnv>();

integrationsRoute.use("*", requireAppUser);

integrationsRoute.get("/", async (c) => {
  const userId = c.get("userId")!;
  const app = c.get("app");
  const connections = await app.channelConnections.listByUserId(userId);
  return c.json({ items: buildIntegrationList(connections) });
});

integrationsRoute.post("/telegram/link", async (c) => {
  const app = c.get("app");
  const userId = c.get("userId")!;
  const webAccountId = c.get("webAccountId")!;
  try {
    const link = await app.telegramLink.createLink(webAccountId, userId);
    return c.json(link);
  } catch (err) {
    const message = err instanceof Error ? err.message : "연결 링크를 만들지 못했습니다.";
    return c.json({ error: message }, 500);
  }
});

integrationsRoute.get("/telegram/link/:token", async (c) => {
  const app = c.get("app");
  const token = c.req.param("token");
  const status = await app.telegramLink.getLinkStatus(token);
  return c.json(status);
});

integrationsRoute.post("/:provider/sync", async (c) => {
  const provider = c.req.param("provider") as ChannelProvider;
  const userId = c.get("userId");
  const app = c.get("app");

  if (provider === "telegram") {
    const user = await app.users.findById(userId!);
    if (!user) return c.json({ error: "User not found" }, 404);
    if (!user.telegramUserId) {
      return c.json({ error: "Telegram이 아직 연결되지 않았습니다." }, 400);
    }
    await app.channelConnections.ensureTelegram(user.id, user.telegramUserId);
    const connections = await app.channelConnections.listByUserId(userId!);
    return c.json({ items: buildIntegrationList(connections) });
  }

  return c.json({ error: `${provider} 연동은 아직 지원하지 않습니다.` }, 501);
});

integrationsRoute.post("/:provider/disconnect", async (c) => {
  const provider = c.req.param("provider") as ChannelProvider;
  const userId = c.get("userId");
  const app = c.get("app");

  if (!userId) {
    return c.json({ error: "연동된 사용자가 없습니다." }, 400);
  }

  if (provider === "telegram") {
    return c.json(
      { error: "Telegram은 주요 입력 채널이라 웹에서 연결 해제할 수 없습니다." },
      400,
    );
  }

  if (provider !== "kakao" && provider !== "slack") {
    return c.json({ error: "Unknown provider" }, 400);
  }

  await app.channelConnections.disconnect(userId, provider);
  const connections = await app.channelConnections.listByUserId(userId);
  return c.json({ items: buildIntegrationList(connections) });
});
