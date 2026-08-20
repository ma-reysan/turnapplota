import "dotenv/config";
import { getDb } from "../src/db";
import { protocols } from "../src/db/schema";
import { DRIVE_PROTOCOL_CATALOG } from "../src/lib/drive-protocol-catalog";

// Diagnóstico de solo lectura: no modifica nada. Sirve para saber por qué
// normalize-protocols no aplicó cambios.

function protocolKey(url: string) {
  const driveId = url.match(/\/d\/([^/?]+)/)?.[1] ?? url.match(/[?&]id=([^&]+)/)?.[1];
  return driveId ? `drive:${driveId}` : url;
}

async function main() {
  const catalogIsNew = DRIVE_PROTOCOL_CATALOG.some((item) => item.category.startsWith("quality_"));
  console.log("--- Código ---");
  console.log(`Entradas en el catálogo: ${DRIVE_PROTOCOL_CATALOG.length}`);
  console.log(`¿Es el catálogo nuevo?: ${catalogIsNew ? "SÍ" : "NO — este checkout está desactualizado, falta git pull"}`);

  const db = getDb();
  const stored = await db.select().from(protocols);
  console.log("\n--- Base de datos ---");
  console.log(`Protocolos en la base: ${stored.length}`);
  if (!stored.length) {
    console.log("La tabla está vacía: el DATABASE_URL apunta a una base sin datos.");
    return;
  }

  const catalogByKey = new Map(DRIVE_PROTOCOL_CATALOG.map((item) => [protocolKey(item.url), item] as const));
  let matched = 0;
  let pending = 0;
  const orphans: string[] = [];
  for (const item of stored) {
    const entry = catalogByKey.get(protocolKey(item.url));
    if (!entry) {
      orphans.push(item.title);
      continue;
    }
    matched += 1;
    if (item.title !== entry.title || item.category !== entry.category) pending += 1;
  }

  console.log(`Coinciden con el catálogo por ID de Drive: ${matched}`);
  console.log(`Pendientes de renombrar/recategorizar: ${pending}`);
  console.log(`Sin coincidencia en el catálogo: ${orphans.length}`);
  if (orphans.length) console.log(orphans.slice(0, 5).map((title) => `  · ${title}`).join("\n"));

  console.log("\n--- Muestra de la base ---");
  for (const item of stored.slice(0, 3)) {
    console.log(`  [${item.category}] ${item.title}`);
  }

  console.log("\n--- Conclusión ---");
  if (!catalogIsNew) {
    console.log("El checkout no tiene los cambios. Haz git pull origin main y vuelve a correr.");
  } else if (pending) {
    console.log(`Todo listo: corre pnpm db:normalize-protocols para actualizar ${pending} protocolos.`);
  } else if (matched) {
    console.log("Los protocolos ya están normalizados. No hay nada pendiente.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
