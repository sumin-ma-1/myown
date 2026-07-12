import type { AppContext } from "../context.js";
import { config } from "../config.js";
import { GoogleCalendarService } from "../services/google-calendar.js";

export function startGoogleCalendarAutoSyncWorker(app: AppContext): () => void {
  if (!GoogleCalendarService.isAvailable()) {
    return () => {};
  }

  const intervalMs = config.googleCalendarAutoSyncCheckIntervalMs;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return () => {};
  }

  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await app.googleCalendar.runDueAutoSyncs();
      if (result.synced > 0) {
        console.log(
          `[gcal-auto] synced ${result.synced} user(s)` +
            (result.errors > 0 ? `, ${result.errors} failed` : ""),
        );
      }
    } catch (err) {
      console.error("[gcal-auto] worker failed:", err);
    } finally {
      running = false;
    }
  };

  const minutes = Math.round(intervalMs / 60_000);
  console.log(`Google Calendar auto-import check: every ${minutes} min`);
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);

  return () => clearInterval(timer);
}
