import type { User } from "@myown/database";
import type { ExtraReminderRule, UserPreferences } from "../types.js";

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
