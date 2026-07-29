import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL no está configurada");
  return drizzle(neon(databaseUrl), { schema });
}

let dbInstance: ReturnType<typeof createDb> | null = null;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!dbInstance) dbInstance = createDb();
  return dbInstance;
}
