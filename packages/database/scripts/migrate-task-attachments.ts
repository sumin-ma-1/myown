/**
 * task_attachments 테이블 생성 + 기존 tasks.attachment_id 연결 백필
 * (db:push 실패 시 수동 실행용)
 */
import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgresql://myown:myown@localhost:5433/myown";
const sql = postgres(url);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS task_attachments (
      task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      attachment_id uuid NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT task_attachments_task_attachment_uidx UNIQUE (task_id, attachment_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS task_attachments_task_id_idx ON task_attachments (task_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS task_attachments_attachment_id_idx ON task_attachments (attachment_id)
  `;

  const backfill = await sql`
    INSERT INTO task_attachments (task_id, attachment_id)
    SELECT id, attachment_id FROM tasks
    WHERE attachment_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `;

  console.log(`task_attachments ready (backfilled ${backfill.count} row(s))`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
