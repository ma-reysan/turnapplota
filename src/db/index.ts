import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

let sqlInstance: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (sqlInstance) return sqlInstance;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL no está configurada");
  sqlInstance = neon(databaseUrl);
  return sqlInstance;
}

function createDb() {
  return drizzle(getSql(), { schema });
}

let dbInstance: ReturnType<typeof createDb> | null = null;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!dbInstance) dbInstance = createDb();
  return dbInstance;
}
