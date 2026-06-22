import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppContext } from "../context.js";
import { config } from "../config.js";
import type { ApiEnv } from "./types.js";
import { tasksRoute } from "./routes/tasks.js";
import { calendarRoute } from "./routes/calendar.js";
import { settingsRoute } from "./routes/settings.js";

export function createApiApp(appContext: AppContext) {
  const app = new Hono<ApiEnv>();

  app.use(
    "*",
    cors({
      origin: config.webCorsOrigin,
      allowHeaders: ["Authorization", "Content-Type"],
    }),
  );

  app.use("*", async (c, next) => {
    c.set("app", appContext);
    await next();
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.route("/api/tasks", tasksRoute);
  app.route("/api/calendar", calendarRoute);
  app.route("/api/settings", settingsRoute);

  return app;
}
