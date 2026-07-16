import type { UserPreferences } from "../api/types.js";

const DEFAULT_DDAY_OFFSETS = [3, 1, 0];

/** undefined → on (기존 사용자 포함) */
export function isDdayEnabled(prefs: UserPreferences): boolean {
  return prefs.notification?.ddayEnabled !== false;
}

/** undefined → on */
export function isMorningBriefingEnabled(prefs: UserPreferences): boolean {
  return prefs.notification?.morningBriefing?.enabled !== false;
}

export function ddayOffsetsForUser(prefs: UserPreferences): number[] {
  if (!isDdayEnabled(prefs)) return [];
  return prefs.notification?.ddayOffsets ?? DEFAULT_DDAY_OFFSETS;
}
