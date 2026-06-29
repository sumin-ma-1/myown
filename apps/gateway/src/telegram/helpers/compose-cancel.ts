import type { AppContext } from "../../context.js";
import type { SessionData } from "../bot.js";
import { clearCompose, type ComposeState } from "../compose-session.js";

export async function cancelComposeRegistration(
  app: AppContext,
  userId: string,
  session: SessionData,
  compose: ComposeState,
): Promise<void> {
  if (compose.draft.attachmentIds.length) {
    for (const attachmentId of compose.draft.attachmentIds) {
      await app.attachmentService.deleteDraftAttachment(userId, attachmentId);
    }
  }
  clearCompose(session);
}
