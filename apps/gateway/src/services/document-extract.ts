import AdmZip from "adm-zip";
import mammoth from "mammoth";
import { XMLParser } from "fast-xml-parser";
import { config } from "../config.js";
import type { detectDocumentKind } from "./attachment-storage.js";

type DocumentKind = ReturnType<typeof detectDocumentKind>;

async function extractPdfText(data: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(data);
  return (result.text ?? "").trim();
}

async function extractDocxText(data: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: data });
  return (result.value ?? "").trim();
}

function collectXmlStrings(value: unknown, out: string[]): void {
  if (value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectXmlStrings(item, out);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectXmlStrings(v, out);
    }
  }
}

function extractHwpxText(data: Buffer): string {
  const zip = new AdmZip(data);
  const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
  const chunks: string[] = [];

  for (const entry of zip.getEntries()) {
    if (!entry.entryName.endsWith(".xml")) continue;
    if (entry.entryName.includes("BinData/")) continue;
    const raw = entry.getData().toString("utf8");
    try {
      const parsed = parser.parse(raw);
      const parts: string[] = [];
      collectXmlStrings(parsed, parts);
      if (parts.length) {
        chunks.push(parts.join(" "));
      }
    } catch {
      const stripped = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (stripped) chunks.push(stripped);
    }
  }

  return chunks.join("\n").trim();
}

async function extractHwpViaSidecar(
  data: Buffer,
  fileName: string,
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([data]), fileName);

  const response = await fetch(`${config.hwpParserUrl}/extract`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `HWP 파서 오류 (${response.status}). hwp-parser 서비스를 실행했는지 확인하세요.\n${detail.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as { text?: string };
  return (payload.text ?? "").trim();
}

async function extractImageText(
  data: Buffer,
  mimeType: string,
): Promise<string> {
  if (!config.llmBaseUrl && !config.openaiApiKey) {
    throw new Error("이미지 OCR에는 LLM 설정(LLM_BASE_URL 또는 OPENAI_API_KEY)이 필요합니다.");
  }

  const OpenAI = (await import("openai")).default;
  const client = config.llmBaseUrl
    ? new OpenAI({
        apiKey: config.openaiApiKey || "ollama",
        baseURL: config.llmBaseUrl,
      })
    : new OpenAI({ apiKey: config.openaiApiKey });

  const base64 = data.toString("base64");
  const response = await client.chat.completions.create({
    model: config.llmModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "이 이미지에서 보이는 모든 텍스트를 한국어 원문 그대로 추출하세요. 표·목록도 포함합니다. 설명 없이 텍스트만 출력하세요.",
          },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    max_tokens: 4096,
  });

  return (response.choices[0]?.message?.content ?? "").trim();
}

export async function extractDocumentText(input: {
  kind: DocumentKind;
  fileName: string;
  mimeType?: string;
  data: Buffer;
}): Promise<string> {
  const { kind, fileName, mimeType, data } = input;

  switch (kind) {
    case "text":
      return data.toString("utf8").trim();
    case "pdf":
      return extractPdfText(data);
    case "docx":
      return extractDocxText(data);
    case "hwpx":
      try {
        return extractHwpxText(data);
      } catch {
        return extractHwpViaSidecar(data, fileName);
      }
    case "hwp":
      return extractHwpViaSidecar(data, fileName);
    case "image":
      return extractImageText(data, mimeType ?? "image/jpeg");
    default:
      throw new Error(
        "지원하지 않는 파일 형식입니다. HWP, HWPX, PDF, DOCX, TXT, 이미지를 보내주세요.",
      );
  }
}

export function truncateForLlm(text: string, maxChars = config.attachmentMaxTextChars): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n...(이하 ${text.length - maxChars}자 생략)`;
}

const DEADLINE_LINE_RE =
  /마감|제출|기한|까지|일자|요청|회신|보고|일정|처리|시행|\d{4}[-./년]\s*\d{1,2}|월\s*\d{1,2}\s*일|D-\d/i;

/** LLM에 보낼 때 본문 앞부분 + 마감·제출 관련 줄만 추려 토큰·시간 절약 */
export function compactTextForAnalysis(
  text: string,
  maxChars = config.attachmentLlmMaxChars,
): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length <= maxChars) return normalized;

  const headBudget = Math.floor(maxChars * 0.45);
  const head = normalized.slice(0, headBudget);

  const seen = new Set<string>();
  const important: string[] = [];
  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 4) continue;
    if (!DEADLINE_LINE_RE.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    important.push(trimmed);
  }

  const tailBudget = maxChars - head.length - 16;
  const tail = important.join("\n").slice(0, Math.max(0, tailBudget));
  const compact = tail ? `${head}\n\n...[중략]...\n\n${tail}` : head;

  return compact.slice(0, maxChars);
}
