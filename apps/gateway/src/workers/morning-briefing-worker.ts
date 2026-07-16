import type { AppContext } from "../context.js";
import { config } from "../config.js";

export function startMorningBriefingWorker(app: AppContext): () => void {
  const intervalMs = config.morningBriefingCheckIntervalMs;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return () => {};
  }

  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await app.morningBriefing.runDueBriefings();
      if (result.sent > 0) {
        console.log(`[morning-briefing] sent ${result.sent} briefing(s)`);
      }
    } catch (err) {
      console.error("[morning-briefing] worker failed:", err);
    } finally {
      running = false;
    }
  };

  const minutes = Math.round(intervalMs / 60_000);
  console.log(`Morning briefing check: every ${minutes} min`);
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);

  return () => clearInterval(timer);
}
