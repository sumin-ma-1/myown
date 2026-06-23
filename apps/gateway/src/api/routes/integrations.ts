import { Hono } from "hono";
import type { ChannelProvider } from "@myown/database";
import type { ApiEnv } from "../types.js";
import { apiAuth } from "../middleware/auth.js";
import { buildIntegrationList } from "../../integrations/catalog.js";

export const integrationsRoute = new Hono<ApiEnv>();

integrationsRoute.use("*", apiAuth);

async function syncTelegramConnection(c: {
  get: (key: "userId" | "app") => string | ApiEnv["Variables"]["app"];
}) {
  const userId = c.get("userId") as string;
  const app = c.get("app") as ApiEnv["Variables"]["app"];
  const user = await app.users.findById(userId);
  if (!user) return;

  const displayName = user.telegramUserId
    ? `Telegram ${user.telegramUserId}`
    : undefined;
  await app.channelConnections.ensureTelegram(user.id, user.telegramUserId, displayName);
}

integrationsRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");

  await syncTelegramConnection(c);

  const connections = await app.channelConnections.listByUserId(userId);
  return c.json({ items: buildIntegrationList(connections) });
});

integrationsRoute.post("/:provider/sync", async (c) => {
  const provider = c.req.param("provider") as ChannelProvider;
  const userId = c.get("userId");
  const app = c.get("app");

  if (provider === "telegram") {
    const user = await app.users.findById(userId);
    if (!user) return c.json({ error: "User not found" }, 404);
    await app.channelConnections.ensureTelegram(user.id, user.telegramUserId);
    const connections = await app.channelConnections.listByUserId(userId);
    return c.json({ items: buildIntegrationList(connections) });
  }

  return c.json({ error: `${provider} 연동은 아직 지원하지 않습니다.` }, 501);
});

integrationsRoute.post("/:provider/disconnect", async (c) => {
  const provider = c.req.param("provider") as ChannelProvider;
  const userId = c.get("userId");
  const app = c.get("app");

  if (provider === "telegram") {
    return c.json(
      { error: "Telegram은 현재 주요 입력 채널이라 웹에서 연결 해제할 수 없습니다." },
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
