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
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false
`;

// 기존 날짜만 마감(로컬 23:59) → all_day=true
const result = await sql`
  UPDATE tasks
  SET all_day = true, updated_at = NOW()
  WHERE due_at IS NOT NULL
    AND all_day = false
    AND EXTRACT(HOUR FROM due_at AT TIME ZONE 'Asia/Seoul') = 23
    AND EXTRACT(MINUTE FROM due_at AT TIME ZONE 'Asia/Seoul') = 59
`;

console.log(`Backfilled all_day=true for ${result.count} task(s) with date-only due_at`);

await sql.end();
