import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";

export async function saveAttachmentFile(
  userId: string,
  fileName: string,
  data: Buffer,
): Promise<string> {
  const safeName = fileName.replace(/[^\w.\-가-힣]/g, "_");
  const relative = join(userId, `${randomUUID()}_${safeName}`);
  const absolute = join(config.attachmentStorageDir, relative);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, data);
  return relative;
}

export function detectDocumentKind(
  fileName: string,
  mimeType?: string,
): "hwp" | "hwpx" | "pdf" | "docx" | "text" | "image" | "unknown" {
  const ext = extname(fileName).toLowerCase();
  if (ext === ".hwp") return "hwp";
  if (ext === ".hwpx") return "hwpx";
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".txt" || ext === ".md") return "text";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return "image";
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "unknown";
}

export const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set([
  ".hwp",
  ".hwpx",
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);
