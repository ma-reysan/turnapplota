import "dotenv/config";
import { and, eq, like } from "drizzle-orm";
import { getDb } from "../src/db";
import { auditEvents, protocols } from "../src/db/schema";

const ACTOR = "Mauri · organización de protocolos";

async function main() {
  const db = getDb();
  const outdated = await db.select().from(protocols).where(like(protocols.title, "Pediatría (archivo anterior)%"));
  if (outdated.length) {
    await db.delete(protocols).where(like(protocols.title, "Pediatría (archivo anterior)%"));
    await db.insert(auditEvents).values(outdated.map((item) => ({
      action: "protocol.deleted",
      entityType: "protocol",
      entityId: item.id,
      before: item,
      actor: ACTOR,
    })));
  }

  const current = await db.select().from(protocols).where(like(protocols.title, "Pediatría 2026 ·%"));
  for (const item of current) {
    const title = item.title.replace(/^Pediatría 2026 ·\s*/, "Pediatría · ");
    const [updated] = await db.update(protocols).set({ title, category: "pediatrics", updatedBy: ACTOR, updatedAt: new Date() }).where(and(eq(protocols.id, item.id), like(protocols.title, "Pediatría 2026 ·%"))).returning();
    if (updated) await db.insert(auditEvents).values({ action: "protocol.updated", entityType: "protocol", entityId: updated.id, before: item, after: updated, actor: ACTOR });
  }
  console.log(`Eliminados ${outdated.length} archivos pediátricos anteriores y renombrados ${current.length} protocolos vigentes.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
