import type { User } from "@myown/database";
import type { ExtraReminderRule, UserPreferences } from "../types.js";

function ruleKey(rule: ExtraReminderRule): string {
  return `${rule.daysBefore ?? ""}:${rule.hoursBefore ?? ""}:${rule.minutesBefore ?? ""}`;
}

function normalizeExtraRules(rules: ExtraReminderRule[]): ExtraReminderRule[] {
  return [...rules]
    .map((r) => ({
      ...(r.daysBefore !== undefined ? { daysBefore: r.daysBefore } : {}),
      ...(r.hoursBefore !== undefined ? { hoursBefore: r.hoursBefore } : {}),
      ...(r.minutesBefore !== undefined ? { minutesBefore: r.minutesBefore } : {}),
    }))
    .sort((a, b) => ruleKey(a).localeCompare(ruleKey(b)));
}

export function extraRulesEqual(a: ExtraReminderRule[], b: ExtraReminderRule[]): boolean {
  const left = normalizeExtraRules(a);
  const right = normalizeExtraRules(b);
  if (left.length !== right.length) return false;
  return left.every((rule, index) => ruleKey(rule) === ruleKey(right[index]));
}

export function getTaskReminderConfig(user: User, taskId: string) {
  const prefs = (user.preferences ?? {}) as UserPreferences;
  return {
    useDefaultReminders: !(prefs.taskReminderSkipDefaults?.[taskId] ?? false),
    extraRules: prefs.taskReminderRules?.[taskId] ?? [],
  };
}

export async function saveTaskReminderConfig(
  updatePreferences: (userId: string, prefs: Record<string, unknown>) => Promise<User | undefined>,
  user: User,
  taskId: string,
  config: { useDefaultReminders?: boolean; extraRules?: ExtraReminderRule[] },
): Promise<User> {
  const prefs = (user.preferences ?? {}) as UserPreferences;

  if (config.useDefaultReminders !== undefined) {
    const skip = { ...(prefs.taskReminderSkipDefaults ?? {}) };
    if (config.useDefaultReminders) {
      delete skip[taskId];
    } else {
      skip[taskId] = true;
    }
    prefs.taskReminderSkipDefaults = skip;
  }

  if (config.extraRules !== undefined) {
    const rules = { ...(prefs.taskReminderRules ?? {}) };
    if (config.extraRules.length === 0) {
      delete rules[taskId];
    } else {
      rules[taskId] = config.extraRules;
    }
    prefs.taskReminderRules = rules;
  }

  const updated = await updatePreferences(user.id, prefs as Record<string, unknown>);
  return updated ?? user;
}
