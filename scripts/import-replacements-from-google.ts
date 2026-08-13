import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { isNull } from "drizzle-orm";
import { getDb } from "../src/db";
import { auditEvents, doctors, replacements } from "../src/db/schema";

const SOURCE_FILE = "/private/tmp/turnapp-reemplazos-google.b64";
const SOURCE_NAME = "Tabla de Reemplazos 2.xlsx (Google Drive)";

function dateFromExcel(value: number) {
  const date = XLSX.SSF.parse_date_code(value);
  if (!date) throw new Error(`Fecha Excel inválida: ${value}`);
  return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function main() {
  const db = getDb();
  const workbook = XLSX.read(Buffer.from(fs.readFileSync(SOURCE_FILE, "utf8"), "base64"), {
    type: "buffer",
  });
  const sheet = workbook.Sheets.Puntajes;
  if (!sheet) throw new Error("No se encontró la hoja Puntajes.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const doctorRows = rows.slice(2, 20);
  const doctorRowsByShortName = new Map(
    doctorRows.map((row) => [String(row[0]).trim().toUpperCase(), row]),
  );
  const doctorRowsInDatabase = await db.select().from(doctors);
  const doctorsByShortName = new Map(
    doctorRowsInDatabase.map((doctor) => [doctor.shortName.trim().toUpperCase(), doctor.id]),
  );

  const existingRows = await db.select().from(replacements).where(isNull(replacements.deletedAt));
  const existingKeys = new Set(
    existingRows.map((item) => `${item.replacementDate}|${item.doctorId}|${item.points}`),
  );

  const missing = [] as Array<{
    id: string;
    replacementDate: string;
    doctorId: string;
    typeCode: string;
    points: number;
    mode: "legacy_unknown";
    superhero: boolean;
    expiresAt: string;
    note: string;
  }>;

  for (let column = 3; column < rows[1].length; column += 1) {
    const rawDate = rows[1][column];
    if (typeof rawDate !== "number") continue;
    const replacementDate = dateFromExcel(rawDate);

    for (const [shortName, row] of doctorRowsByShortName) {
      const points = row[column];
      if (typeof points !== "number" || points <= 0) continue;
      const doctorId = doctorsByShortName.get(shortName);
      if (!doctorId) throw new Error(`Médico sin equivalencia: ${shortName}`);
      const key = `${replacementDate}|${doctorId}|${points}`;
      if (existingKeys.has(key)) continue;
      missing.push({
        id: `google-replacements-${replacementDate}-${doctorId}-${points}`,
        replacementDate,
        doctorId,
        typeCode: "LEGACY_UNKNOWN",
        points,
        mode: "legacy_unknown",
        superhero: false,
        expiresAt: addDays(replacementDate, 120),
        note: `Importado desde ${SOURCE_NAME}`,
      });
      existingKeys.add(key);
    }
  }

  if (missing.length) {
    await db.insert(replacements).values(missing);
    await db.insert(auditEvents).values({
      action: "import",
      entityType: "replacements",
      entityId: "google-drive-tabla-reemplazos",
      actor: "importación Google Drive",
      after: {
        source: SOURCE_NAME,
        imported: missing.length,
        lastInvokedDoctorId: "rodriguez",
      },
    });
  }

  console.log(`Importados ${missing.length} puntajes nuevos.`);
  for (const item of missing) {
    console.log(`${item.replacementDate} ${item.doctorId} +${item.points}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
