import type { Task, User, UserRepository } from "@myown/database";
import type { ExtraReminderRule } from "../api/types.js";
import { saveTaskReminderConfig } from "../api/helpers/task-reminders.js";
import { parseRemindDateTime } from "../utils/datetime-parse.js";
import { formatDateTime } from "../utils/date.js";
import type { ReminderService } from "./reminder.js";

export interface AbsoluteReminderTime {
  date?: string;
  time: string;
}

/** 초안·도구용 업무별 알림 의도 (전역 설정과 무관) */
export interface DraftReminderConfig {
  useDefaultReminders: boolean;
  extraRules?: ExtraReminderRule[];
  absoluteTimes?: AbsoluteReminderTime[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseExtraRule(raw: unknown): ExtraReminderRule | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const rule: ExtraReminderRule = {};
  const days = obj.daysBefore ?? obj.days_before;
  const hours = obj.hoursBefore ?? obj.hours_before;
  const minutes = obj.minutesBefore ?? obj.minutes_before;
  if (typeof days === "number" && Number.isFinite(days)) {
    rule.daysBefore = Math.max(0, Math.floor(days));
  }
  if (typeof hours === "number" && Number.isFinite(hours)) {
    rule.hoursBefore = Math.max(0, Math.floor(hours));
  }
  if (typeof minutes === "number" && Number.isFinite(minutes)) {
    rule.minutesBefore = Math.max(0, Math.floor(minutes));
  }
  if (
    rule.daysBefore === undefined &&
    rule.hoursBefore === undefined &&
    rule.minutesBefore === undefined
  ) {
    return null;
  }
  return rule;
}

function parseAbsoluteTime(raw: unknown): AbsoluteReminderTime | null {
  const obj = asRecord(raw);
  if (!obj || typeof obj.time !== "string" || !obj.time.trim()) return null;
  const time = obj.time.trim();
  if (!/^\d{1,2}:\d{2}$/.test(time)) return null;
  const date =
    typeof obj.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.date.trim())
      ? obj.date.trim()
      : undefined;
  return { date, time };
}

/** create_task / set_task_reminders 인자에서 파싱. 없으면 undefined(기본 D-DAY). */
export function parseDraftReminderConfig(
  args: Record<string, unknown>,
): DraftReminderConfig | undefined {
  const raw =
    args.reminder_config ??
    args.reminderConfig ??
    (args.use_default_reminders !== undefined ||
    args.useDefaultReminders !== undefined ||
    args.extra_rules !== undefined ||
    args.extraRules !== undefined ||
    args.absolute_times !== undefined ||
    args.absoluteTimes !== undefined
      ? args
      : undefined);

  if (raw === undefined || raw === null) return undefined;

  if (typeof raw === "boolean") {
    return raw
      ? { useDefaultReminders: true }
      : { useDefaultReminders: false, extraRules: [], absoluteTimes: [] };
  }

  const obj = asRecord(raw);
  if (!obj) return undefined;

  const useDefault =
    typeof obj.useDefaultReminders === "boolean"
      ? obj.useDefaultReminders
      : typeof obj.use_default_reminders === "boolean"
        ? obj.use_default_reminders
        : true;

  const extraRaw = obj.extraRules ?? obj.extra_rules;
  const extraRules = Array.isArray(extraRaw)
    ? extraRaw.map(parseExtraRule).filter((r): r is ExtraReminderRule => r !== null)
    : undefined;

  const absRaw = obj.absoluteTimes ?? obj.absolute_times;
  const absoluteTimes = Array.isArray(absRaw)
    ? absRaw.map(parseAbsoluteTime).filter((t): t is AbsoluteReminderTime => t !== null)
    : undefined;

  return {
    useDefaultReminders: useDefault,
    ...(extraRules ? { extraRules } : {}),
    ...(absoluteTimes ? { absoluteTimes } : {}),
  };
}

export function formatReminderConfigLabel(config: DraftReminderConfig | undefined): string | null {
  if (!config) return null;

  const parts: string[] = [];
  if (config.useDefaultReminders) {
    parts.push("기본 D-DAY");
  }

  for (const rule of config.extraRules ?? []) {
    const bits: string[] = [];
    if (rule.daysBefore !== undefined) bits.push(`D-${rule.daysBefore}`);
    if (rule.hoursBefore) bits.push(`${rule.hoursBefore}시간 전`);
    if (rule.minutesBefore) bits.push(`${rule.minutesBefore}분 전`);
    if (bits.length) parts.push(bits.join(" "));
  }

  for (const at of config.absoluteTimes ?? []) {
    const fireAt = parseRemindDateTime(at.date, at.time);
    parts.push(fireAt ? formatDateTime(fireAt) : `${at.date ?? "오늘"} ${at.time}`);
  }

  if (!config.useDefaultReminders && parts.length === 0) {
    return "없음";
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

export async function applyDraftReminderConfig(input: {
  users: UserRepository;
  reminderService: ReminderService;
  userId: string;
  telegramUserId: number | null;
  task: Task;
  config: DraftReminderConfig | undefined;
  /** true면 pending을 취소 후 다시 맞춤 (수정) */
  sync?: boolean;
}): Promise<User | undefined> {
  const { users, reminderService, userId, telegramUserId, task, config, sync } = input;
  if (!task.dueAt) return users.findById(userId);

  let user = await users.findById(userId);
  if (!user) return undefined;

  if (!config) {
    if (sync) {
      if (task.recurrenceRule) {
        await reminderService.cancelForTask(task.id);
        await reminderService.scheduleRecurringWindow(task, telegramUserId, user);
      } else {
        await reminderService.syncRemindersForTask(task, telegramUserId, user);
      }
    } else if (task.recurrenceRule) {
      await reminderService.scheduleRecurringWindow(task, telegramUserId, user);
    } else {
      await reminderService.scheduleForTask(task, telegramUserId, user);
    }
    return user;
  }

  const extraRules = config.extraRules ?? [];
  user = await saveTaskReminderConfig(
    (id, prefs) => users.updatePreferences(id, prefs),
    user,
    task.id,
    {
      useDefaultReminders: config.useDefaultReminders,
      extraRules,
    },
  );

  if (sync) {
    // absoluteTimes까지 포함해 전량 재설정
    await reminderService.cancelForTask(task.id);
  }

  if (task.recurrenceRule) {
    await reminderService.scheduleRecurringWindow(task, telegramUserId, user, {
      useDefaults: config.useDefaultReminders,
      extraRules,
    });
  } else {
    await reminderService.scheduleForTask(task, telegramUserId, user, {
      useDefaults: config.useDefaultReminders,
      extraRules,
    });
  }

  for (const at of config.absoluteTimes ?? []) {
    const fireAt = parseRemindDateTime(at.date, at.time);
    if (!fireAt) continue;
    try {
      await reminderService.scheduleAt(task, telegramUserId, fireAt);
    } catch {
      // 과거 시각 등은 건너뜀
    }
  }

  return user;
}
