import { Hono } from "hono";
import type { ApiEnv } from "../types.js";
import { requireAppUser } from "../middleware/session.js";
import { serializeTask } from "../serializers/task.js";
import { loadTaskAttachments } from "../helpers/load-task-attachments.js";
import { expandRecurrence } from "../../utils/recurrence.js";

export const calendarRoute = new Hono<ApiEnv>();

calendarRoute.use("*", requireAppUser);

calendarRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  const fromRaw = c.req.query("from");
  const toRaw = c.req.query("to");

  if (!fromRaw || !toRaw) {
    return c.json({ error: "from and to query params are required (ISO date)" }, 400);
  }

  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return c.json({ error: "invalid date range" }, 400);
  }

  if (!userId) return c.json({ items: [] });

  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const includeCompleted = c.req.query("includeCompleted") === "true";

  const [singles, seriesList] = await Promise.all([
    app.tasks.listDueInRange(userId, from, to, { includeCompleted }),
    app.tasks.listRecurring(userId, { includeCompleted }),
  ]);

  const exceptions = await app.recurrenceExceptions.listForTasks(seriesList.map((t) => t.id));
  const exceptionsByTask = new Map<string, typeof exceptions>();
  for (const ex of exceptions) {
    const list = exceptionsByTask.get(ex.taskId) ?? [];
    list.push(ex);
    exceptionsByTask.set(ex.taskId, list);
  }

  const items = [];

  for (const task of singles) {
    const attachments = await loadTaskAttachments(app, userId, task);
    const reminders = await app.reminders.listForTask(task.id);
    items.push(serializeTask(task, user, attachments, reminders));
  }

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
      from,
      to,
    );
    const exList = exceptionsByTask.get(task.id) ?? [];
    for (const occ of occs) {
      const ex = exList.find(
        (e) => e.occurrenceStartsAt.getTime() === occ.occurrenceStartsAt.getTime(),
      );
      if (ex?.action === "cancelled") continue;
      const status =
        ex?.action === "completed"
          ? ("completed" as const)
          : task.status === "completed"
            ? ("completed" as const)
            : ("active" as const);
      if (!includeCompleted && status === "completed") continue;
      items.push(
        serializeTask(task, user, attachments, reminders, {
          occurrenceStartsAt: occ.occurrenceStartsAt,
          startsAt: ex?.action === "modified" && ex.startsAt !== undefined ? ex.startsAt : occ.startsAt,
          dueAt: ex?.action === "modified" && ex.dueAt ? ex.dueAt : occ.dueAt,
          title: ex?.action === "modified" && ex.title ? ex.title : undefined,
          status,
        }),
      );
    }
  }

  items.sort((a, b) => {
    const aT = a.dueAt ? new Date(a.dueAt).getTime() : 0;
    const bT = b.dueAt ? new Date(b.dueAt).getTime() : 0;
    return aT - bT;
  });

  return c.json({ items });
});
