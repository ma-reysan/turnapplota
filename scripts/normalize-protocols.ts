import "dotenv/config";
import { and, eq, like, ne } from "drizzle-orm";
import { getDb } from "../src/db";
import { auditEvents, protocols } from "../src/db/schema";
import { DRIVE_PROTOCOL_CATALOG } from "../src/lib/drive-protocol-catalog";
import type { ProtocolCategory } from "../src/lib/types";

const ACTOR = "Mauri · organización de protocolos";

// Categorías por prefijo, para las filas que no vienen del catálogo de Drive.
const CATEGORY_FIXES: Array<{ prefix: string; category: ProtocolCategory }> = [
  { prefix: "Cirugía ·", category: "surgery" },
  { prefix: "Neurología ·", category: "neurology" },
  { prefix: "Oftalmología ·", category: "ophthalmology" },
  { prefix: "ORL ·", category: "ent" },
];

// Drive entrega el mismo archivo con parámetros distintos (/view, ?usp=drivesdk),
// así que el ID es la única llave estable para reconciliar con la base.
function protocolKey(url: string) {
  const driveId = url.match(/\/d\/([^/?]+)/)?.[1] ?? url.match(/[?&]id=([^&]+)/)?.[1];
  return driveId ? `drive:${driveId}` : url;
}

const catalogByKey = new Map(
  DRIVE_PROTOCOL_CATALOG.map((item) => [protocolKey(item.url), item] as const),
);

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

  // Alinea título y categoría de cada fila con el catálogo, sin tocar la URL.
  let renamed = 0;
  const stored = await db.select().from(protocols);
  for (const item of stored) {
    const entry = catalogByKey.get(protocolKey(item.url));
    if (!entry) continue;
    if (item.title === entry.title && item.category === entry.category) continue;
    const [updated] = await db
      .update(protocols)
      .set({ title: entry.title, category: entry.category, updatedBy: ACTOR, updatedAt: new Date() })
      .where(eq(protocols.id, item.id))
      .returning();
    if (updated) {
      await db.insert(auditEvents).values({ action: "protocol.updated", entityType: "protocol", entityId: updated.id, before: item, after: updated, actor: ACTOR });
      renamed += 1;
    }
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

  console.log(
    `Eliminados ${outdated.length} archivos pediátricos anteriores, renombrados ${current.length} protocolos vigentes, ` +
      `normalizados ${renamed} desde el catálogo y recategorizados ${recategorized} por prefijo.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
