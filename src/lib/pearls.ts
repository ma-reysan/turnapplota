import { eq } from "drizzle-orm";
import seed from "@/data/seed.json";
import { getDb, isDatabaseConfigured } from "@/db";
import { pearlVersions } from "@/db/schema";
import { NOVEMBER_PEARLS } from "@/lib/november-pearls";

export async function getPearlVersions() {
  if (!isDatabaseConfigured()) return { current: seed.pearls, future: NOVEMBER_PEARLS };
  const rows = await getDb().select().from(pearlVersions);
  return {
    current: rows.find((row) => row.version === "current")?.lines ?? seed.pearls,
    future: rows.find((row) => row.version === "future")?.lines ?? NOVEMBER_PEARLS,
  };
}
