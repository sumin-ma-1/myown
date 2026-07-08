import { Hono } from "hono";
import type { ApiEnv } from "../types.js";
import { requireAppUser } from "../middleware/session.js";
import { WebChatService } from "../../services/web-chat.js";

export const chatRoute = new Hono<ApiEnv>();

chatRoute.use("*", requireAppUser);

function chatService(c: { get: (k: "app") => ApiEnv["Variables"]["app"] }) {
  return new WebChatService(c.get("app"));
}

chatRoute.get("/compose", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "User not found" }, 404);

  const compose = await chatService(c).getCompose(userId);
  return c.json({ compose });
});

chatRoute.post("/messages", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "User not found" }, 404);

  const body = await c.req.json<{ text?: string }>();
  if (!body.text?.trim()) {
    return c.json({ error: "text is required" }, 400);
  }

  const result = await chatService(c).handleText(userId, body.text);
  return c.json(result);
});

chatRoute.post("/compose/memo", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "User not found" }, 404);

  const body = await c.req.json<{ text?: string }>();
  if (!body.text?.trim()) {
    return c.json({ error: "text is required" }, 400);
  }

  const result = await chatService(c).addMemo(userId, body.text);
  return c.json(result);
});

chatRoute.post("/compose/files", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "User not found" }, 404);

  const body = await c.req.parseBody();
  const raw = body.file ?? body.files;
  const file = (Array.isArray(raw) ? raw[0] : raw) as File | undefined;
  if (!file || typeof file === "string") {
    return c.json({ error: "file is required" }, 400);
  }

  const caption = typeof body.caption === "string" ? body.caption : undefined;
  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await chatService(c).addFile(
    userId,
    { fileName: file.name, mimeType: file.type || undefined, data: buffer },
    caption,
  );
  return c.json(result);
});

chatRoute.post("/compose/register", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "User not found" }, 404);

  const result = await chatService(c).register(userId);
  return c.json(result);
});

chatRoute.delete("/compose", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "User not found" }, 404);

  const result = await chatService(c).cancel(userId);
  return c.json(result);
});
