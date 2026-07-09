import { serve } from "@hono/node-server";
import { createRedisConnection, createReminderWorker } from "./services/reminder-queue.js";
import { createApiApp } from "./api/index.js";
import { createContext } from "./context.js";
import { config } from "./config.js";
import { createBot } from "./telegram/bot.js";
import { setupTelegramMenuButton } from "./telegram/menu-button.js";
import { handleReminderJob } from "./workers/reminder-worker.js";

async function main() {
  const redis = createRedisConnection();
  const app = createContext(redis);
  const bot = createBot(app);
  await setupTelegramMenuButton(bot);

  const worker = createReminderWorker(async (job) => {
    await handleReminderJob(bot, app, job);
  });

  worker.on("failed", (job, err) => {
    console.error(`Reminder job failed: ${job?.id}`, err);
  });

  const api = createApiApp(app);
  serve({ fetch: api.fetch, port: config.webApiPort }, () => {
    console.log(`Web API: http://localhost:${config.webApiPort}`);
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    await worker.close();
    await app.reminderQueue.close();
    await redis.quit();
    await bot.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  if (config.webhookUrl) {
    const path = `/telegram/${config.telegramBotToken}`;
    await bot.api.setWebhook(`${config.webhookUrl}${path}`);
    await bot.start({
      webhook: {
        domain: config.webhookUrl,
        port: config.webhookPort,
        path,
      },
    } as Parameters<typeof bot.start>[0]);
    console.log(`Webhook mode: ${config.webhookUrl}${path}`);
  } else {
    await bot.api.deleteWebhook();
    bot.start();
    console.log("Long polling mode started");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
