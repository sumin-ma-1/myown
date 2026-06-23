import { Hono } from "hono";
import type { TaskPriority } from "@myown/database";
import { TASK_PRIORITIES } from "@myown/database";
import { endOfDayInTimezone, startOfDayInTimezone } from "../../utils/date.js";
import type { ApiEnv, TaskWorkflowStatus, UserPreferences } from "../types.js";
import { serializeTask } from "../serializers/task.js";
import { apiAuth } from "../middleware/auth.js";

const PRIORITIES = new Set<TaskPriority>(TASK_PRIORITIES);
const WORKFLOW = new Set<TaskWorkflowStatus>(["planned", "in_progress"]);

async function serializeTaskById(
  app: ApiEnv["Variables"]["app"],
  userId: string,
  taskId: string,
) {
  const task = await app.tasks.findById(userId, taskId);
  if (!task) return null;

  const user = await app.users.findById(userId);
  if (!user) return null;

  const attachment = task.attachmentId
    ? await app.attachments.findById(userId, task.attachmentId)
    : undefined;
  const reminders = await app.reminders.listForTask(taskId);
  return serializeTask(task, user, attachment, reminders);
}

export const tasksRoute = new Hono<ApiEnv>();

tasksRoute.use("*", apiAuth);

tasksRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
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
      const attachment = task.attachmentId
        ? await app.attachments.findById(userId, task.attachmentId)
        : undefined;
      const reminders = await app.reminders.listForTask(task.id);
      return serializeTask(task, user, attachment, reminders);
    }),
  );

  return c.json({ items });
});

tasksRoute.get("/today", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const start = startOfDayInTimezone();
  const end = endOfDayInTimezone();
  const tasks = await app.tasks.listDueToday(userId, start, end);

  const items = await Promise.all(
    tasks.map(async (task) => {
      const attachment = task.attachmentId
        ? await app.attachments.findById(userId, task.attachmentId)
        : undefined;
      const reminders = await app.reminders.listForTask(task.id);
      return serializeTask(task, user, attachment, reminders);
    }),
  );

  return c.json({ items });
});

tasksRoute.post("/", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  const body = await c.req.json<{
    title?: string;
    description?: string;
    priority?: TaskPriority;
    dueAt?: string;
  }>();

  if (!body.title?.trim()) {
    return c.json({ error: "title is required" }, 400);
  }
  if (body.priority && !PRIORITIES.has(body.priority)) {
    return c.json({ error: "invalid priority" }, 400);
  }

  const task = await app.tasks.create({
    userId,
    title: body.title.trim(),
    description: body.description?.trim(),
    priority: body.priority,
    dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
  });

  const user = await app.users.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const telegramId = user.telegramUserId;
  if (task.dueAt) {
    await app.reminderService.scheduleForTask(task, telegramId);
  }

  return c.json({ item: serializeTask(task, user, undefined, []) }, 201);
});

tasksRoute.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  const taskId = c.req.param("id");
  const body = await c.req.json<{
    title?: string;
    priority?: TaskPriority;
    dueAt?: string | null;
    status?: "active" | "completed" | "cancelled";
    workflowStatus?: TaskWorkflowStatus;
  }>();

  const existing = await app.tasks.findById(userId, taskId);
  if (!existing) return c.json({ error: "Task not found" }, 404);

  if (body.priority && !PRIORITIES.has(body.priority)) {
    return c.json({ error: "invalid priority" }, 400);
  }
  if (body.workflowStatus && !WORKFLOW.has(body.workflowStatus)) {
    return c.json({ error: "invalid workflowStatus" }, 400);
  }

  if (body.workflowStatus) {
    const user = await app.users.findById(userId);
    if (!user) return c.json({ error: "User not found" }, 404);
    const prefs = (user.preferences ?? {}) as UserPreferences;
    const taskWorkflow = { ...(prefs.taskWorkflow ?? {}), [taskId]: body.workflowStatus };
    await app.users.updatePreferences(userId, { ...prefs, taskWorkflow });
  }

  const task = await app.tasks.update(userId, taskId, {
    title: body.title?.trim(),
    priority: body.priority,
    dueAt: body.dueAt === null ? null : body.dueAt ? new Date(body.dueAt) : undefined,
    status: body.status,
  });

  if (!task) return c.json({ error: "Task not found" }, 404);

  if (body.status === "completed") {
    await app.reminderService.cancelForTask(taskId);
  }

  const item = await serializeTaskById(app, userId, taskId);
  if (!item) return c.json({ error: "Task not found" }, 404);

  return c.json({ item });
});

tasksRoute.get("/:id/reminders", async (c) => {
  const userId = c.get("userId");
  const app = c.get("app");
  const taskId = c.req.param("id");

  const task = await app.tasks.findById(userId, taskId);
  if (!task) return c.json({ error: "Task not found" }, 404);

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
