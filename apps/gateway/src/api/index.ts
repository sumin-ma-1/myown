import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppContext } from "../context.js";
import { config } from "../config.js";
import type { ApiEnv } from "./types.js";
import { sessionMiddleware } from "./middleware/session.js";
import { tasksRoute } from "./routes/tasks.js";
import { calendarRoute } from "./routes/calendar.js";
import { settingsRoute } from "./routes/settings.js";
import { integrationsRoute } from "./routes/integrations.js";
import { remindersRoute } from "./routes/reminders.js";
import { attachmentsRoute } from "./routes/attachments.js";
import { authRoute } from "./routes/auth.js";
import { adminRoute } from "./routes/admin.js";

export function createApiApp(appContext: AppContext) {
  const app = new Hono<ApiEnv>();

  app.use(
    "*",
    cors({
      origin: config.webCorsOrigin,
      credentials: true,
      allowHeaders: ["Authorization", "Content-Type"],
    }),
  );

  app.use("*", async (c, next) => {
    c.set("app", appContext);
    await next();
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.route("/api/auth", authRoute);
  app.route("/api/admin", adminRoute);

  app.use("/api/*", sessionMiddleware);

  app.route("/api/tasks", tasksRoute);
  app.route("/api/reminders", remindersRoute);
  app.route("/api/attachments", attachmentsRoute);
  app.route("/api/calendar", calendarRoute);
  app.route("/api/settings", settingsRoute);
  app.route("/api/integrations", integrationsRoute);

  return app;
}
