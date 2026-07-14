/**
 * user_notifications 테이블 추가
 */
import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgresql://myown:myown@localhost:5433/myown";
const sql = postgres(url);

async function main() {
  await sql`
    DO $$ BEGIN
      CREATE TYPE user_notification_type AS ENUM ('gcal_auto_sync', 'gcal_auth_expired');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type user_notification_type NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      payload jsonb DEFAULT '{}'::jsonb,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
      ON user_notifications (user_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_notifications_user_read_idx
      ON user_notifications (user_id, read_at)
  `;

  console.log("user_notifications table ready");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
