import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAllowedUserIds(raw: string): Set<number> {
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => Number(id)),
  );
}

if (process.env.ALLOWED_TELEGRAM_USER_IDS?.trim() === "") {
  console.warn("WARNING: ALLOWED_TELEGRAM_USER_IDS is empty. No one can use the bot.");
}

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  allowedTelegramUserIds: parseAllowedUserIds(
    process.env.ALLOWED_TELEGRAM_USER_IDS ?? "",
  ),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  timezone: process.env.TIMEZONE ?? "Asia/Seoul",
  reminderHour: Number(process.env.REMINDER_HOUR ?? "9"),
  /** OpenAI 또는 Ollama 등 OpenAI 호환 API 키. Ollama는 아무 값이나 가능 */
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  /** 원격 Ollama 터널 등. 예: http://localhost:11434/v1 */
  llmBaseUrl: process.env.LLM_BASE_URL ?? "",
  llmModel: process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? "120000"),
  webhookUrl: process.env.WEBHOOK_URL ?? "",
  webhookPort: Number(process.env.WEBHOOK_PORT ?? "3000"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  /** 로컬 첨부 저장 경로 */
  attachmentStorageDir:
    process.env.ATTACHMENT_STORAGE_DIR ??
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/attachments"),
  /** HWP 파서 sidecar URL */
  hwpParserUrl: process.env.HWP_PARSER_URL ?? "http://localhost:8100",
  attachmentMaxBytes: Number(process.env.ATTACHMENT_MAX_MB ?? "20") * 1024 * 1024,
  /** DB 저장용 전체 추출 텍스트 상한 */
  attachmentMaxTextChars: Number(process.env.ATTACHMENT_MAX_TEXT_CHARS ?? "50000"),
  /** LLM 분석에 보낼 텍스트 상한 (짧을수록 빠름) */
  attachmentLlmMaxChars: Number(process.env.ATTACHMENT_LLM_MAX_CHARS ?? "6000"),
  /** 첨부 분석 전용 모델 (미설정 시 LLM_MODEL) */
  attachmentLlmModel: process.env.ATTACHMENT_LLM_MODEL ?? "",
  attachmentLlmTimeoutMs: Number(process.env.ATTACHMENT_LLM_TIMEOUT_MS ?? "90000"),
  attachmentLlmMaxTokens: Number(process.env.ATTACHMENT_LLM_MAX_TOKENS ?? "1200"),
};

export function isLlmEnabled(): boolean {
  return Boolean(config.llmBaseUrl || config.openaiApiKey);
}

export function isUserAllowed(telegramUserId: number): boolean {
  if (config.allowedTelegramUserIds.size === 0) return false;
  return config.allowedTelegramUserIds.has(telegramUserId);
}
