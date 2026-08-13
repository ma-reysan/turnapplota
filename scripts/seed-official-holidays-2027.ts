import "dotenv/config";
import { getDb } from "../src/db";
import { holidays } from "../src/db/schema";

const OFFICIAL_HOLIDAYS_2027 = [
  ["2027-01-01", "Año Nuevo"],
  ["2027-03-26", "Viernes Santo"],
  ["2027-03-27", "Sábado Santo"],
  ["2027-05-01", "Día del Trabajo"],
  ["2027-05-21", "Día de las Glorias Navales"],
  ["2027-06-20", "Día Nacional de los Pueblos Indígenas"],
  ["2027-06-28", "San Pedro y San Pablo"],
  ["2027-07-16", "Virgen del Carmen"],
  ["2027-08-15", "Asunción de la Virgen"],
  ["2027-09-18", "Independencia Nacional"],
  ["2027-09-19", "Día de las Glorias del Ejército"],
  ["2027-10-11", "Encuentro de Dos Mundos"],
  ["2027-10-31", "Día de las Iglesias Evangélicas y Protestantes"],
  ["2027-11-01", "Día de Todos los Santos"],
  ["2027-12-08", "Inmaculada Concepción"],
  ["2027-12-25", "Navidad"],
] as const;

async function main() {
  const db = getDb();
  const inserted = await db
    .insert(holidays)
    .values(
      OFFICIAL_HOLIDAYS_2027.map(([holidayDate, label]) => ({
        holidayDate,
        label,
      })),
    )
    .onConflictDoNothing()
    .returning();

  console.log(`Feriados oficiales 2027 añadidos: ${inserted.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
