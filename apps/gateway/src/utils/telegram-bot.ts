import { config } from "../config.js";

let cachedBotUsername: string | null | undefined;

export async function resolveTelegramBotUsername(): Promise<string | null> {
  const configured = config.telegramBotUsername.trim().replace(/^@/, "");
  if (configured) return configured;

  if (cachedBotUsername !== undefined) {
    return cachedBotUsername;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/getMe`,
    );
    const body = (await res.json()) as {
      ok?: boolean;
      result?: { username?: string };
    };
    cachedBotUsername = body.ok && body.result?.username ? body.result.username : null;
  } catch {
    cachedBotUsername = null;
  }

  return cachedBotUsername;
}

export function telegramMiniAppDeepLink(username: string, startParam: string): string {
  const shortName = config.telegramWebAppShortName.trim();
  if (shortName) {
    return `https://t.me/${username}/${shortName}?startapp=${encodeURIComponent(startParam)}`;
  }
  return `https://t.me/${username}?startapp=${encodeURIComponent(startParam)}`;
}
