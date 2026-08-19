import "dotenv/config";
import { and, eq, like, ne } from "drizzle-orm";
import { getDb } from "../src/db";
import { auditEvents, protocols } from "../src/db/schema";
import type { ProtocolCategory } from "../src/lib/types";

const ACTOR = "Mauri · organización de protocolos";

const CATEGORY_FIXES: Array<{ prefix: string; category: ProtocolCategory }> = [
  { prefix: "Cirugía ·", category: "surgery" },
  { prefix: "Neurología ·", category: "neurology" },
  { prefix: "Oftalmología ·", category: "ophthalmology" },
  { prefix: "ORL ·", category: "ent" },
];

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
  let recategorized = 0;
  for (const { prefix, category } of CATEGORY_FIXES) {
    const mismatched = await db
      .select()
      .from(protocols)
      .where(and(like(protocols.title, `${prefix}%`), ne(protocols.category, category)));
    for (const item of mismatched) {
      const [updated] = await db
        .update(protocols)
        .set({ category, updatedBy: ACTOR, updatedAt: new Date() })
        .where(eq(protocols.id, item.id))
        .returning();
      if (updated) {
        await db.insert(auditEvents).values({ action: "protocol.updated", entityType: "protocol", entityId: updated.id, before: item, after: updated, actor: ACTOR });
        recategorized += 1;
      }
    }
  }

  console.log(`Eliminados ${outdated.length} archivos pediátricos anteriores, renombrados ${current.length} protocolos vigentes y recategorizados ${recategorized} protocolos.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
