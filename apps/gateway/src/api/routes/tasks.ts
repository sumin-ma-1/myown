import { Hono } from "hono";
import type { TaskPriority } from "@myown/database";
import { TASK_PRIORITIES } from "@myown/database";
import { endOfDayInTimezone, startOfDayInTimezone } from "../../utils/date.js";
import { ddayOffsetsForUser } from "../../utils/notification-prefs.js";
import {
  buildReminderFireTimes,
  extraRuleFireTime,
  isReminderDateOnly,
  reminderAnchorAt,
} from "../../services/reminder-schedule.js";
import {
  clearSuppressedFireTimes,
  extraRulesEqual,
  filterSuppressedFireTimes,
  getSuppressedFireTimes,
  getTaskReminderConfig,
  saveTaskReminderConfig,
} from "../helpers/task-reminders.js";
import { loadTaskAttachments } from "../helpers/load-task-attachments.js";
import type { ApiEnv, ExtraReminderRule, TaskWorkflowStatus, UserPreferences } from "../types.js";
import { serializeTask } from "../serializers/task.js";
import { requireAppUser } from "../middleware/session.js";
import { config } from "../../config.js";
import { requireLinkedUser } from "../helpers/linked-user.js";
import { expandRecurrence, parseOccurrenceInstanceId } from "../../utils/recurrence.js";

const PRIORITIES = new Set<TaskPriority>(TASK_PRIORITIES);
const WORKFLOW = new Set<TaskWorkflowStatus>(["planned", "in_progress"]);

function resolveTaskIdParam(raw: string): {
  taskId: string;
  occurrenceStartsAt: Date | null;
} {
  const parsed = parseOccurrenceInstanceId(raw);
  if (parsed) return { taskId: parsed.taskId, occurrenceStartsAt: parsed.occurrenceStartsAt };
  return { taskId: raw, occurrenceStartsAt: null };
}

async function serializeTaskById(
  app: ApiEnv["Variables"]["app"],
  userId: string,
  taskId: string,
  occurrenceStartsAt?: Date | null,
) {
  const task = await app.tasks.findById(userId, taskId);
  if (!task) return null;

  const user = await app.users.findById(userId);
  if (!user) return null;

  const attachments = await loadTaskAttachments(app, userId, task);
  const reminders = await app.reminders.listForTask(taskId);

  if (occurrenceStartsAt && task.recurrenceRule && task.dueAt) {
    const ex = await app.recurrenceExceptions.find(taskId, occurrenceStartsAt);
    const durationMs = task.dueAt.getTime() - (task.startsAt ?? task.dueAt).getTime();
    const hasStart = Boolean(task.startsAt);
    const occDue =
      ex?.action === "modified" && ex.dueAt
        ? ex.dueAt
        : hasStart
          ? new Date(occurrenceStartsAt.getTime() + durationMs)
          : occurrenceStartsAt;
    const occStart =
      ex?.action === "modified" && ex.startsAt !== undefined
        ? ex.startsAt
        : hasStart
          ? occurrenceStartsAt
          : null;
    return serializeTask(task, user, attachments, reminders, {
      occurrenceStartsAt,
      startsAt: occStart,
      dueAt: occDue,
      title: ex?.action === "modified" ? ex.title : undefined,
      status: ex?.action === "completed" ? "completed" : task.status,
    });
  }

  return serializeTask(task, user, attachments, reminders);
}

function parseExtraRules(raw?: ExtraReminderRule[]): ExtraReminderRule[] {
  if (!raw?.length) return [];
  return raw
    .map((r) => ({
      daysBefore: r.daysBefore !== undefined ? Number(r.daysBefore) : undefined,
      hoursBefore: r.hoursBefore !== undefined ? Number(r.hoursBefore) : undefined,
      minutesBefore: r.minutesBefore !== undefined ? Number(r.minutesBefore) : undefined,
    }))
    .filter(
      (r) =>
        (r.daysBefore !== undefined && r.daysBefore >= 0) ||
        (r.hoursBefore !== undefined && r.hoursBefore > 0) ||
        (r.minutesBefore !== undefined && r.minutesBefore > 0),
    );
}

export const tasksRoute = new Hono<ApiEnv>();

tasksRoute.use("*", requireAppUser);

tasksRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  if (!userId) return c.json({ items: [] });

  const sort = c.req.query("sort") ?? "listIndex";
  const status = (c.req.query("status") ?? "active") as "active" | "completed" | "all";

  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const tasks = await app.tasks.listForUser(userId, {
    status,
    sort: sort as "priority" | "dueAt" | "listIndex" | "createdAt",
    limit: 200,
  });

  const items = await Promise.all(
    tasks.map(async (task) => {
      const attachments = await loadTaskAttachments(app, userId, task);
      const reminders = await app.reminders.listForTask(task.id);
      return serializeTask(task, user, attachments, reminders);
    }),
  );

  return c.json({ items });
});

tasksRoute.get("/today", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  if (!userId) return c.json({ items: [] });

  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const start = startOfDayInTimezone();
  const end = endOfDayInTimezone();
  const [tasks, seriesList] = await Promise.all([
    app.tasks.listDueToday(userId, start, end),
    app.tasks.listRecurring(userId),
  ]);

  const items = await Promise.all(
    tasks.map(async (task) => {
      const attachments = await loadTaskAttachments(app, userId, task);
      const reminders = await app.reminders.listForTask(task.id);
      return serializeTask(task, user, attachments, reminders);
    }),
  );

  const exceptions = await app.recurrenceExceptions.listForTasks(seriesList.map((t) => t.id));
  for (const task of seriesList) {
    if (!task.dueAt || !task.recurrenceRule) continue;
    const attachments = await loadTaskAttachments(app, userId, task);
    const reminders = await app.reminders.listForTask(task.id);
    const occs = expandRecurrence(
      {
        recurrenceRule: task.recurrenceRule,
        recurrenceUntil: task.recurrenceUntil,
        recurrenceCount: task.recurrenceCount,
        startsAt: task.startsAt,
        dueAt: task.dueAt,
        allDay: task.allDay,
      },
      start,
      end,
    );
    for (const occ of occs) {
      const ex = exceptions.find(
        (e) =>
          e.taskId === task.id &&
          e.occurrenceStartsAt.getTime() === occ.occurrenceStartsAt.getTime(),
      );
      if (ex?.action === "cancelled" || ex?.action === "completed") continue;
      items.push(
        serializeTask(task, user, attachments, reminders, {
          occurrenceStartsAt: occ.occurrenceStartsAt,
          startsAt:
            ex?.action === "modified" && ex.startsAt !== undefined ? ex.startsAt : occ.startsAt,
          dueAt: ex?.action === "modified" && ex.dueAt ? ex.dueAt : occ.dueAt,
          title: ex?.action === "modified" && ex.title ? ex.title : undefined,
        }),
      );
    }
  }

  return c.json({ items });
});

tasksRoute.get("/:id", async (c) => {
  const userId = requireLinkedUser(c);
  if (userId instanceof Response) return userId;
  const app = c.get("app");
  const { taskId, occurrenceStartsAt } = resolveTaskIdParam(c.req.param("id"));

  const item = await serializeTaskById(app, userId, taskId, occurrenceStartsAt);
  if (!item) return c.json({ error: "Task not found" }, 404);

  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const reminderConfig = getTaskReminderConfig(user, taskId);
  const prefs = (user.preferences ?? {}) as UserPreferences;
  const ddayOffsets = ddayOffsetsForUser(prefs);
  const reminderHour = prefs.notification?.reminderHour ?? config.reminderHour;

  let defaultPreview: string[] = [];
  const previewAnchor = item.dueAt
    ? reminderAnchorAt({
        dueAt: new Date(item.dueAt),
        startsAt: item.startsAt ? new Date(item.startsAt) : null,
      })
    : null;
  if (previewAnchor && reminderConfig.useDefaultReminders) {
    const fireTimes = filterSuppressedFireTimes(
      buildReminderFireTimes(previewAnchor, {
        ddayOffsets,
        reminderHour,
        extraRules: [],
        dateOnly: isReminderDateOnly({
          dueAt: new Date(item.dueAt!),
          startsAt: item.startsAt ? new Date(item.startsAt) : null,
          allDay: item.allDay,
        }),
      }),
      getSuppressedFireTimes(user, taskId),
    );
    defaultPreview = fireTimes.map((d) => d.toISOString());
  }

  return c.json({
    item,
    reminderConfig: {
      ...reminderConfig,
      defaultPreview,
      ddayOffsets,
      reminderHour,
    },
  });
});

tasksRoute.post("/", async (c) => {
  const userId = requireLinkedUser(c);
  if (userId instanceof Response) return userId;
  const app = c.get("app");
  const body = await c.req.json<{
    title?: string;
    description?: string;
    priority?: TaskPriority;
    dueAt?: string;
    startsAt?: string | null;
    allDay?: boolean;
    recurrenceRule?: string | null;
    recurrenceUntil?: string | null;
    recurrenceCount?: number | null;
    recurrenceTimezone?: string | null;
    workflowStatus?: TaskWorkflowStatus;
    useDefaultReminders?: boolean;
    extraReminders?: ExtraReminderRule[];
  }>();

  if (!body.title?.trim()) {
    return c.json({ error: "title is required" }, 400);
  }
  if (!body.dueAt) {
    return c.json({ error: "dueAt is required" }, 400);
  }
  if (body.priority && !PRIORITIES.has(body.priority)) {
    return c.json({ error: "invalid priority" }, 400);
  }
  if (body.workflowStatus && !WORKFLOW.has(body.workflowStatus)) {
    return c.json({ error: "invalid workflowStatus" }, 400);
  }

  const task = await app.tasks.create({
    userId,
    title: body.title.trim(),
    description: body.description?.trim(),
    priority: body.priority,
    dueAt: new Date(body.dueAt),
    startsAt: body.startsAt ? new Date(body.startsAt) : body.startsAt === null ? null : undefined,
    allDay: body.allDay,
    recurrenceRule: body.recurrenceRule?.trim() || null,
    recurrenceUntil: body.recurrenceUntil ? new Date(body.recurrenceUntil) : null,
    recurrenceCount: body.recurrenceCount ?? null,
    recurrenceTimezone: body.recurrenceTimezone ?? "Asia/Seoul",
  });

  let user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const workflowStatus: TaskWorkflowStatus = body.workflowStatus ?? "planned";
  const prefs = (user.preferences ?? {}) as UserPreferences;
  const taskWorkflow = { ...(prefs.taskWorkflow ?? {}), [task.id]: workflowStatus };
  user =
    (await app.users.updatePreferences(userId, { ...prefs, taskWorkflow })) ?? user;

  const extraRules = parseExtraRules(body.extraReminders);
  const useDefaults = body.useDefaultReminders ?? true;

  if (extraRules.length > 0 || !useDefaults) {
    user = await saveTaskReminderConfig(
      (id, prefs) => app.users.updatePreferences(id, prefs),
      user,
      task.id,
      { useDefaultReminders: useDefaults, extraRules },
    );
  }

  const telegramId = user.telegramUserId ?? null;
  if (task.dueAt) {
    if (task.recurrenceRule) {
      await app.reminderService.scheduleRecurringWindow(task, telegramId, user, {
        useDefaults,
        extraRules,
      });
    } else {
      await app.reminderService.scheduleForTask(task, telegramId, user, {
        useDefaults,
        extraRules,
      });
    }
  }

  const item = await serializeTaskById(app, userId, task.id);
  return c.json({ item }, 201);
});

tasksRoute.patch("/:id", async (c) => {
  const userId = requireLinkedUser(c);
  if (userId instanceof Response) return userId;
  const app = c.get("app");
  const { taskId, occurrenceStartsAt } = resolveTaskIdParam(c.req.param("id"));
  const body = await c.req.json<{
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    dueAt?: string | null;
    startsAt?: string | null;
    allDay?: boolean;
    recurrenceRule?: string | null;
    recurrenceUntil?: string | null;
    recurrenceCount?: number | null;
    recurrenceTimezone?: string | null;
    /** series = 전체, this = 이번만, following = 이번 이후 */
    recurrenceEditScope?: "series" | "this" | "following";
    status?: "active" | "completed" | "cancelled";
    workflowStatus?: TaskWorkflowStatus;
    useDefaultReminders?: boolean;
    extraReminders?: ExtraReminderRule[];
    rescheduleReminders?: boolean;
  }>();

  const existing = await app.tasks.findById(userId, taskId);
  if (!existing) return c.json({ error: "Task not found" }, 404);

  if (body.priority && !PRIORITIES.has(body.priority)) {
    return c.json({ error: "invalid priority" }, 400);
  }
  if (body.workflowStatus && !WORKFLOW.has(body.workflowStatus)) {
    return c.json({ error: "invalid workflowStatus" }, 400);
  }
  if (body.dueAt === null) {
    return c.json({ error: "dueAt is required" }, 400);
  }

  let user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const scope = body.recurrenceEditScope ?? "series";

  // 이번만 완료/취소/수정
  if (existing.recurrenceRule && occurrenceStartsAt && scope === "this") {
    if (body.status === "completed") {
      await app.recurrenceExceptions.upsert({
        taskId,
        occurrenceStartsAt,
        action: "completed",
      });
      const item = await serializeTaskById(app, userId, taskId, occurrenceStartsAt);
      return c.json({ item });
    }
    if (body.status === "cancelled") {
      await app.recurrenceExceptions.upsert({
        taskId,
        occurrenceStartsAt,
        action: "cancelled",
      });
      return c.json({ item: await serializeTaskById(app, userId, taskId, occurrenceStartsAt) });
    }
    await app.recurrenceExceptions.upsert({
      taskId,
      occurrenceStartsAt,
      action: "modified",
      title: body.title?.trim(),
      startsAt: body.startsAt === null ? null : body.startsAt ? new Date(body.startsAt) : undefined,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      allDay: body.allDay,
    });
    const item = await serializeTaskById(app, userId, taskId, occurrenceStartsAt);
    return c.json({ item });
  }

  // 이번 이후: 기존 시리즈 UNTIL을 이 발생 전날로 끊고, 새 시리즈 생성
  if (existing.recurrenceRule && occurrenceStartsAt && scope === "following") {
    const until = new Date(occurrenceStartsAt.getTime() - 86_400_000);
    await app.tasks.update(userId, taskId, {
      recurrenceUntil: until,
    });
    const newTask = await app.tasks.create({
      userId,
      title: body.title?.trim() || existing.title,
      description:
        body.description !== undefined
          ? body.description ?? undefined
          : existing.description ?? undefined,
      priority: body.priority ?? existing.priority,
      dueAt: body.dueAt ? new Date(body.dueAt) : existing.dueAt ?? undefined,
      startsAt: body.startsAt
        ? new Date(body.startsAt)
        : body.startsAt === null
          ? null
          : existing.startsAt,
      allDay: body.allDay ?? existing.allDay,
      recurrenceRule:
        body.recurrenceRule !== undefined
          ? body.recurrenceRule
          : existing.recurrenceRule,
      recurrenceUntil:
        body.recurrenceUntil !== undefined
          ? body.recurrenceUntil
            ? new Date(body.recurrenceUntil)
            : null
          : existing.recurrenceUntil,
      recurrenceCount:
        body.recurrenceCount !== undefined ? body.recurrenceCount : existing.recurrenceCount,
      recurrenceTimezone: existing.recurrenceTimezone,
    });
    if (newTask.dueAt && newTask.recurrenceRule) {
      await app.reminderService.scheduleRecurringWindow(
        newTask,
        user.telegramUserId ?? null,
        user,
      );
    }
    const item = await serializeTaskById(app, userId, newTask.id);
    return c.json({ item });
  }

  if (body.workflowStatus) {
    const prefs = (user.preferences ?? {}) as UserPreferences;
    const taskWorkflow = { ...(prefs.taskWorkflow ?? {}), [taskId]: body.workflowStatus };
    user =
      (await app.users.updatePreferences(userId, { ...prefs, taskWorkflow })) ?? user;
  }

  const dueAtChanged =
    body.dueAt !== undefined &&
    (body.dueAt === null
      ? existing.dueAt !== null
      : new Date(body.dueAt).getTime() !== existing.dueAt?.getTime());
  const startsAtChanged =
    body.startsAt !== undefined &&
    (body.startsAt === null
      ? existing.startsAt !== null
      : new Date(body.startsAt).getTime() !== existing.startsAt?.getTime());
  const allDayChanged =
    body.allDay !== undefined && body.allDay !== existing.allDay;
  const recurrenceChanged =
    (body.recurrenceRule !== undefined &&
      (body.recurrenceRule || null) !== (existing.recurrenceRule || null)) ||
    (body.recurrenceUntil !== undefined &&
      (body.recurrenceUntil
        ? new Date(body.recurrenceUntil).getTime()
        : null) !== (existing.recurrenceUntil?.getTime() ?? null)) ||
    (body.recurrenceCount !== undefined &&
      body.recurrenceCount !== existing.recurrenceCount);
  const scheduleChanged =
    dueAtChanged || startsAtChanged || allDayChanged || recurrenceChanged;

  const existingReminderConfig = getTaskReminderConfig(user, taskId);
  const extraRules =
    body.extraReminders !== undefined ? parseExtraRules(body.extraReminders) : undefined;
  const useDefaultChanged =
    body.useDefaultReminders !== undefined &&
    body.useDefaultReminders !== existingReminderConfig.useDefaultReminders;
  const extraRulesChanged =
    extraRules !== undefined &&
    !extraRulesEqual(extraRules, existingReminderConfig.extraRules);
  const reminderConfigChanged = useDefaultChanged || extraRulesChanged;

  if (reminderConfigChanged) {
    user = await saveTaskReminderConfig(
      (id, prefs) => app.users.updatePreferences(id, prefs),
      user,
      taskId,
      {
        ...(body.useDefaultReminders !== undefined && {
          useDefaultReminders: body.useDefaultReminders,
        }),
        ...(extraRules !== undefined && { extraRules }),
      },
    );
  }

  // 시리즈 전체 완료
  if (body.status === "completed" && existing.recurrenceRule && !occurrenceStartsAt) {
    // keep series complete
  }

  const task = await app.tasks.update(userId, taskId, {
    title: body.title?.trim(),
    description: body.description,
    priority: body.priority,
    dueAt: body.dueAt === null ? null : body.dueAt ? new Date(body.dueAt) : undefined,
    startsAt:
      body.startsAt === null ? null : body.startsAt ? new Date(body.startsAt) : undefined,
    allDay: body.allDay,
    recurrenceRule:
      body.recurrenceRule !== undefined ? body.recurrenceRule || null : undefined,
    recurrenceUntil:
      body.recurrenceUntil !== undefined
        ? body.recurrenceUntil
          ? new Date(body.recurrenceUntil)
          : null
        : undefined,
    recurrenceCount:
      body.recurrenceCount !== undefined ? body.recurrenceCount : undefined,
    recurrenceTimezone:
      body.recurrenceTimezone !== undefined ? body.recurrenceTimezone : undefined,
    status: body.status,
  });

  if (!task) return c.json({ error: "Task not found" }, 404);

  if (scheduleChanged) {
    const prefs = (user.preferences ?? {}) as UserPreferences;
    user =
      (await app.users.updatePreferences(userId, {
        ...clearSuppressedFireTimes(prefs, taskId),
      } as Record<string, unknown>)) ?? user;
  }

  if (body.status === "completed") {
    await app.reminderService.cancelForTask(taskId);
  } else if (
    task.dueAt &&
    (scheduleChanged || reminderConfigChanged || body.rescheduleReminders)
  ) {
    const config = getTaskReminderConfig(user, taskId);
    if (task.recurrenceRule) {
      await app.reminderService.cancelForTask(taskId);
      await app.reminderService.scheduleRecurringWindow(
        task,
        user.telegramUserId ?? null,
        user,
        {
          useDefaults: config.useDefaultReminders,
          extraRules: config.extraRules,
        },
      );
    } else {
      await app.reminderService.syncRemindersForTask(task, user.telegramUserId ?? null, user, {
        useDefaults: config.useDefaultReminders,
        extraRules: config.extraRules,
      });
    }
  } else if (dueAtChanged && !task.dueAt) {
    await app.reminderService.cancelForTask(taskId);
  }

  const item = await serializeTaskById(app, userId, task.id);
  return c.json({ item });
});

tasksRoute.delete("/:id", async (c) => {
  const userId = requireLinkedUser(c);
  if (userId instanceof Response) return userId;
  const app = c.get("app");
  const { taskId } = resolveTaskIdParam(c.req.param("id"));

  const task = await app.tasks.findById(userId, taskId);
  if (!task) return c.json({ error: "Task not found" }, 404);

  await app.reminderService.cancelForTask(taskId);

  const user = await app.users.findById(userId);
  if (user) {
    const prefs = (user.preferences ?? {}) as UserPreferences;
    const taskWorkflow = { ...(prefs.taskWorkflow ?? {}) };
    const taskReminderRules = { ...(prefs.taskReminderRules ?? {}) };
    const taskReminderSkipDefaults = { ...(prefs.taskReminderSkipDefaults ?? {}) };
    const taskReminderSuppressedAt = { ...(prefs.taskReminderSuppressedAt ?? {}) };
    delete taskWorkflow[taskId];
    delete taskReminderRules[taskId];
    delete taskReminderSkipDefaults[taskId];
    delete taskReminderSuppressedAt[taskId];
    await app.users.updatePreferences(userId, {
      ...prefs,
      taskWorkflow,
      taskReminderRules,
      taskReminderSkipDefaults,
      taskReminderSuppressedAt,
    });
  }

  const deleted = await app.tasks.delete(userId, taskId);
  if (!deleted) return c.json({ error: "Task not found" }, 404);

  return c.json({ ok: true });
});

tasksRoute.get("/:id/reminders", async (c) => {
  const userId = requireLinkedUser(c);
  if (userId instanceof Response) return userId;
  const app = c.get("app");
  const taskId = c.req.param("id");

  const task = await app.tasks.findById(userId, taskId);
  if (!task) return c.json({ error: "Task not found" }, 404);

  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  if (task.status === "active" && task.dueAt) {
    const config = getTaskReminderConfig(user, taskId);
    await app.reminderService.syncRemindersForTask(task, user.telegramUserId ?? null, user, {
      useDefaults: config.useDefaultReminders,
      extraRules: config.extraRules,
    });
  }

  const reminders = await app.reminders.listForTask(taskId);
  return c.json({
    items: reminders.map((r) => ({
      id: r.id,
      fireAt: r.fireAt.toISOString(),
      status: r.status,
      sentAt: r.sentAt?.toISOString() ?? null,
    })),
  });
});

tasksRoute.post("/:id/reminders", async (c) => {
  const userId = requireLinkedUser(c);
  if (userId instanceof Response) return userId;
  const app = c.get("app");
  const taskId = c.req.param("id");
  const body = await c.req.json<{
    fireAt?: string;
    daysBefore?: number;
    hoursBefore?: number;
    minutesBefore?: number;
  }>();

  const task = await app.tasks.findById(userId, taskId);
  if (!task) return c.json({ error: "Task not found" }, 404);
  const anchorAt = reminderAnchorAt(task);
  if (!anchorAt) return c.json({ error: "Task has no due date" }, 400);

  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  let fireAt: Date;
  if (body.fireAt) {
    fireAt = new Date(body.fireAt);
  } else {
    const computed = extraRuleFireTime(anchorAt, {
      daysBefore: body.daysBefore,
      hoursBefore: body.hoursBefore,
      minutesBefore: body.minutesBefore,
    }, isReminderDateOnly(task));
    if (!computed) {
      return c.json({ error: "fireAt, daysBefore, hoursBefore, or minutesBefore required" }, 400);
    }
    fireAt = computed;
  }

  try {
    const scheduledAt = await app.reminderService.scheduleAt(
      task,
      user.telegramUserId ?? null,
      fireAt,
    );
    return c.json({ fireAt: scheduledAt.toISOString() }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to schedule reminder";
    return c.json({ error: message }, 400);
  }
});

tasksRoute.post("/:id/attachment", async (c) => {
  const userId = requireLinkedUser(c);
  if (userId instanceof Response) return userId;
  const app = c.get("app");
  const taskId = c.req.param("id");

  const task = await app.tasks.findById(userId, taskId);
  if (!task) return c.json({ error: "Task not found" }, 404);

  const body = await c.req.parseBody();
  const raw = body.file ?? body.files;
  const fileList = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
    (f): f is File => typeof f !== "string",
  );

  if (fileList.length === 0) {
    return c.json({ error: "file is required" }, 400);
  }

  const uploaded: string[] = [];
  for (const file of fileList) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await app.attachmentService.attachToTask({
      userId,
      taskId,
      fileName: file.name,
      mimeType: file.type || undefined,
      data: buffer,
    });
    if (!result.ok) return c.json({ error: result.message }, 400);
    uploaded.push(result.fileName);
  }

  const item = await serializeTaskById(app, userId, taskId);
  return c.json({ item, fileNames: uploaded });
});

tasksRoute.delete("/:id/attachments/:attachmentId", async (c) => {
  const userId = requireLinkedUser(c);
  if (userId instanceof Response) return userId;
  const app = c.get("app");
  const taskId = c.req.param("id");
  const attachmentId = c.req.param("attachmentId");

  const task = await app.tasks.findById(userId, taskId);
  if (!task) return c.json({ error: "Task not found" }, 404);

  const attachment = await app.attachments.findById(userId, attachmentId);
  if (!attachment) return c.json({ error: "Attachment not found" }, 404);

  const unlinked = await app.taskAttachments.unlink(taskId, attachmentId);
  const isLegacyOnly = !unlinked && task.attachmentId === attachmentId;

  if (!unlinked && !isLegacyOnly) {
    return c.json({ error: "Attachment not linked to task" }, 404);
  }

  if (isLegacyOnly) {
    await app.tasks.update(userId, taskId, { attachmentId: null });
  } else if (task.attachmentId === attachmentId) {
    const remaining = await app.taskAttachments.listForTask(userId, taskId);
    const nextPrimary = remaining[0]?.id ?? null;
    await app.tasks.update(userId, taskId, { attachmentId: nextPrimary });
  }

  const item = await serializeTaskById(app, userId, taskId);
  if (!item) return c.json({ error: "Task not found" }, 404);

  return c.json({ item });
});
