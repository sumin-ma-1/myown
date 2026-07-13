/**
 * google_calendar_connections 자동 가져오기 설정 컬럼 추가
 */
import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgresql://myown:myown@localhost:5433/myown";
const sql = postgres(url);

async function main() {
  await sql`
    ALTER TABLE google_calendar_connections
      ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT false
  `;
  await sql`
    ALTER TABLE google_calendar_connections
      ADD COLUMN IF NOT EXISTS auto_sync_interval_hours integer NOT NULL DEFAULT 24
  `;
  await sql`
    ALTER TABLE google_calendar_connections
      ADD COLUMN IF NOT EXISTS auto_sync_past_days integer NOT NULL DEFAULT 7
  `;
  await sql`
    ALTER TABLE google_calendar_connections
      ADD COLUMN IF NOT EXISTS auto_sync_future_days integer NOT NULL DEFAULT 90
  `;
  await sql`
    ALTER TABLE google_calendar_connections
      ADD COLUMN IF NOT EXISTS last_auto_synced_at timestamptz
  `;

  await sql`
    ALTER TABLE google_calendar_connections
      ALTER COLUMN auto_sync_enabled SET DEFAULT false
  `;
  await sql`
    ALTER TABLE google_calendar_connections
      ADD COLUMN IF NOT EXISTS auto_sync_activate_imports boolean NOT NULL DEFAULT true
  `;

  console.log("google_calendar_connections auto-sync columns ready");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
