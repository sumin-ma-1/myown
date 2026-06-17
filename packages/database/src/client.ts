import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 10 });
  return drizzle(client, { schema });
}

export function getDb(connectionString: string) {
  if (!db) {
    db = createDb(connectionString);
  }
  return db;
}

export type Database = ReturnType<typeof createDb>;
