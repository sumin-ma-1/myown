import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import type { ApiEnv } from "../types.js";
import { requireLinkedUser } from "../helpers/linked-user.js";
import { apiAuth } from "../middleware/auth.js";

export const attachmentsRoute = new Hono<ApiEnv>();

attachmentsRoute.use("*", apiAuth);

attachmentsRoute.get("/:id/download", async (c) => {
  const userId = requireLinkedUser(c);
  if (userId instanceof Response) return userId;
  const app = c.get("app");
  const attachmentId = c.req.param("id");

  const attachment = await app.attachments.findById(userId, attachmentId);
  if (!attachment) {
    return c.json({ error: "Attachment not found" }, 404);
  }
  if (attachment.status === "failed" || attachment.status === "processing") {
    return c.json({ error: "File is not ready for download" }, 404);
  }

  const absolutePath = app.attachmentService.getAbsolutePath(attachment.storagePath);

  let data: Buffer;
  try {
    data = await readFile(absolutePath);
  } catch {
    return c.json({ error: "File not found on disk" }, 404);
  }

  const encodedName = encodeURIComponent(attachment.fileName);
  return new Response(data, {
    headers: {
      "Content-Type": attachment.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Content-Length": String(data.length),
    },
  });
});
