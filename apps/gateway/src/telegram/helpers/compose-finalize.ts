import type { Task } from "@myown/database";
import type { AppContext } from "../../context.js";
import { formatTaskDetail } from "../../utils/format.js";
import type { ComposeState } from "../compose-session.js";

export async function buildComposeRegistrationSummary(
  app: AppContext,
  userId: string,
  task: Task,
): Promise<string> {
  const attachments = await app.taskAttachments.listForTask(
    userId,
    task.id,
    task.attachmentId,
  );

  const lines = ["✅ 업무를 등록했습니다.", "", formatTaskDetail(task)];
  if (attachments.length > 0) {
    lines.push("", ...attachments.map((a) => `📎 ${a.fileName}`));
  }
  return lines.join("\n");
}

export async function finalizeComposeRegistration(
  app: AppContext,
  input: {
    userId: string;
    telegramUserId: number | null;
    compose: ComposeState;
  },
): Promise<{ ok: true; summary: string } | { ok: false; message: string }> {
  try {
    const task = await app.attachmentService.registerFromDraft({
      userId: input.userId,
      telegramUserId: input.telegramUserId,
      draft: input.compose.draft,
    });
    const summary = await buildComposeRegistrationSummary(app, input.userId, task);
    return { ok: true, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : "업무 등록에 실패했습니다.";
    return { ok: false, message };
  }
}
