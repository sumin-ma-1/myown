import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

await sql`
  ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS recurrence_until timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence_count integer,
  ADD COLUMN IF NOT EXISTS recurrence_timezone text NOT NULL DEFAULT 'Asia/Seoul'
`;

await sql`
  CREATE INDEX IF NOT EXISTS tasks_recurrence_rule_idx
  ON tasks (user_id, recurrence_rule)
`;

await sql`
  DO $$ BEGIN
    CREATE TYPE recurrence_exception_action AS ENUM ('cancelled', 'completed', 'modified');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  CREATE TABLE IF NOT EXISTS task_recurrence_exceptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    occurrence_starts_at timestamptz NOT NULL,
    action recurrence_exception_action NOT NULL,
    title text,
    starts_at timestamptz,
    due_at timestamptz,
    all_day boolean,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  )
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS task_recurrence_exceptions_task_occ_uidx
  ON task_recurrence_exceptions (task_id, occurrence_starts_at)
`;

await sql`
  CREATE INDEX IF NOT EXISTS task_recurrence_exceptions_task_id_idx
  ON task_recurrence_exceptions (task_id)
`;

console.log("Migrated task recurrence columns + task_recurrence_exceptions");

await sql.end();
