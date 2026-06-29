import type { Task } from "@myown/database";
import type { AppContext } from "../../context.js";

type App = AppContext;

export async function loadTaskAttachments(app: App, userId: string, task: Task) {
  if (task.attachmentId) {
    await app.taskAttachments.link(task.id, task.attachmentId);
  }
  return app.taskAttachments.listForTask(userId, task.id, task.attachmentId);
}
