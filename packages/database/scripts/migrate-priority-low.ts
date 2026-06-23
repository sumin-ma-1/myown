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

const result = await sql`
  UPDATE tasks
  SET priority = 'medium', updated_at = NOW()
  WHERE priority = 'low'
`;

console.log(`Migrated ${result.count} task(s): low → medium`);

await sql.end();
