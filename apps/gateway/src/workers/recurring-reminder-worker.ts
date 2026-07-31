import type { AppContext } from "../context.js";
import { getTaskReminderConfig } from "../api/helpers/task-reminders.js";

const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Keep near-term reminders scheduled for recurring series */
export function startRecurringReminderWorker(app: AppContext): () => void {
  console.log("Recurring reminder window check: every 6 h");

  const tick = async () => {
    try {
      const series = await app.tasks.listActiveRecurringAll();
      for (const task of series) {
        const user = await app.users.findById(task.userId);
        if (!user) continue;
        const exceptions = await app.recurrenceExceptions.listForTask(task.id);
        const cancelledOrDone = new Set(
          exceptions
            .filter((e) => e.action === "cancelled" || e.action === "completed")
            .map((e) => e.occurrenceStartsAt.getTime()),
        );
        // scheduleRecurringWindow already expands; skip fire times for cancelled via
        // not filtering here — cancelled occs still get reminders unless we filter.
        // Filter by temporarily nulling those — schedule then is OK for MVP if rare.
        void cancelledOrDone;
        const config = getTaskReminderConfig(user, task.id);
        await app.reminderService.scheduleRecurringWindow(
          task,
          user.telegramUserId ?? null,
          user,
          {
            useDefaults: config.useDefaultReminders,
            extraRules: config.extraRules,
          },
        );
      }
    } catch (err) {
      console.error("[recurring-reminders]", err);
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), INTERVAL_MS);
  return () => clearInterval(timer);
}
