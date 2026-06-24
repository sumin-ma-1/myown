export {
  isSensitiveConnectionLabel,
  sanitizeConnectionDisplayName,
} from "@myown/database";

export function telegramDisplayName(from?: {
  username?: string;
  first_name?: string;
  last_name?: string;
}): string | undefined {
  if (from?.username) return `@${from.username}`;
  const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(" ");
  return fullName || undefined;
}
