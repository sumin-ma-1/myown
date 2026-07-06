/** UI/API에 노출하면 안 되는 연동 표시명 (숫자 ID 등) */
export function isSensitiveConnectionLabel(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const trimmed = value.trim();
  return (
    /^Telegram \d+$/i.test(trimmed) ||
    /^\d{6,}$/.test(trimmed) ||
    /^[a-f0-9]{20,}$/i.test(trimmed)
  );
}

export function sanitizeConnectionDisplayName(
  value: string | null | undefined,
): string | null {
  if (!value?.trim() || isSensitiveConnectionLabel(value)) return null;
  return value.trim();
}
