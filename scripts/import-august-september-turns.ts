import "dotenv/config";
import { execFileSync } from "node:child_process";
import * as XLSX from "xlsx";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../src/db";
import {
  auditEvents,
  doctors,
  scheduleMonths,
  shiftAssignments,
  shiftColorLegend,
  shiftMarkers,
} from "../src/db/schema";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SOURCE_FILE =
  args.find((argument) => argument !== "--dry-run") ??
  "/Users/ma.reyessantana/Downloads/Turnos MEDICOS.xlsx";

const MONTHS = [
  { sheetName: "AGOSTO 2026", scheduleId: "2026-08", year: 2026, month: 8 },
  { sheetName: "SEPTIEMBRE 2026 (P)", scheduleId: "2026-09", year: 2026, month: 9 },
] as const;

const NAME_ALIASES: Record<string, string> = {
  VALDEVENITO: "VALDEBENITO",
};

const COLOR_BY_EXCEL_FILL: Record<string, string> = {
  FFFF9900: "orange",
  FFFFD966: "yellow",
  FFC9DAF8: "sky",
  FFF4CCCC: "coral",
};

const LEGENDS = [
  { colorKey: "orange", label: "Cambios de turno" },
  { colorKey: "yellow", label: "Reemplazo por permisos/LM" },
  { colorKey: "sky", label: "Reemplazo Dra. Vera" },
  { colorKey: "coral", label: "Feriado" },
];

type ParsedAssignment = {
  id: string;
  scheduleId: string;
  shiftDate: string;
  kind: "DAY" | "NIGHT";
  slot: number;
  doctorId: string;
};

type ParsedMarker = {
  id: string;
  scheduleId: string;
  shiftDate: string;
  kind: "DAY" | "NIGHT";
  slot: number;
  colorKey: string;
};

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function isoDate(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) throw new Error(`Fecha Excel inválida: ${value}`);
  return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
}

function readMarkerColorsByCell(workbook: XLSX.WorkBook) {
  const stylesXml = execFileSync("unzip", ["-p", SOURCE_FILE, "xl/styles.xml"], {
    encoding: "utf8",
  });
  const cellXfsXml = stylesXml.match(/<cellXfs[\s\S]*?<\/cellXfs>/)?.[0] ?? "";
  const styleFillIds = [...cellXfsXml.matchAll(/<xf\b[^>]*>/g)].map((match) => {
    return Number(match[0].match(/fillId="(\d+)"/)?.[1] ?? 0);
  });
  const fillsXml = stylesXml.match(/<fills[\s\S]*?<\/fills>/)?.[0] ?? "";
  const fillColors = [...fillsXml.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((match) => {
    return match[1].match(/fgColor[^>]*rgb="([A-Fa-f0-9]+)"/)?.[1]?.toUpperCase();
  });

  const result = new Map<string, Map<string, string>>();
  for (const month of MONTHS) {
    const sheetIndex = workbook.SheetNames.indexOf(month.sheetName) + 1;
    const sheetXml = execFileSync(
      "unzip",
      ["-p", SOURCE_FILE, `xl/worksheets/sheet${sheetIndex}.xml`],
      { encoding: "utf8" },
    );
    const markers = new Map<string, string>();
    for (const match of sheetXml.matchAll(/<c\b([^>]*)>/g)) {
      const attributes = match[1];
      const ref = attributes.match(/\br="([A-Z]+\d+)"/)?.[1];
      const style = Number(attributes.match(/\bs="(\d+)"/)?.[1] ?? 0);
      const colorKey = COLOR_BY_EXCEL_FILL[fillColors[styleFillIds[style]] ?? ""];
      if (ref && colorKey) markers.set(ref, colorKey);
    }
    result.set(month.sheetName, markers);
  }
  return result;
}

function parseMonth(
  sheet: XLSX.WorkSheet,
  month: (typeof MONTHS)[number],
  doctorsByShortName: Map<string, string>,
  markersByCell: Map<string, string>,
) {
  const assignments: ParsedAssignment[] = [];
  const markers: ParsedMarker[] = [];
  const unknownNames = new Set<string>();
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:H1");

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const dates = Array.from({ length: 7 }, (_, index) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: index + 1 })];
      if (typeof cell?.v !== "number") return null;
      const parsed = XLSX.SSF.parse_date_code(cell.v);
      if (!parsed || parsed.y !== month.year || parsed.m !== month.month) return null;
      return isoDate(cell.v);
    });

    if (!dates.some(Boolean)) continue;

    const shiftRows = [
      { offset: 1, kind: "DAY" as const, slot: 1 },
      { offset: 2, kind: "DAY" as const, slot: 2 },
      { offset: 3, kind: "DAY" as const, slot: 3 },
      { offset: 4, kind: "NIGHT" as const, slot: 1 },
      { offset: 5, kind: "NIGHT" as const, slot: 2 },
    ];

    for (const shift of shiftRows) {
      for (let columnOffset = 0; columnOffset < 7; columnOffset += 1) {
        const shiftDate = dates[columnOffset];
        if (!shiftDate) continue;
        const cell = sheet[
          XLSX.utils.encode_cell({ r: row + shift.offset, c: columnOffset + 1 })
        ];
        const normalized = NAME_ALIASES[normalizeName(cell?.v)] ?? normalizeName(cell?.v);
        if (!normalized) continue;
        const doctorId = doctorsByShortName.get(normalized);
        if (!doctorId) {
          unknownNames.add(normalized);
          continue;
        }

        const id = `${month.scheduleId}-${shiftDate}-${shift.kind.toLowerCase()}-${shift.slot}`;
        assignments.push({
          id,
          scheduleId: month.scheduleId,
          shiftDate,
          kind: shift.kind,
          slot: shift.slot,
          doctorId,
        });

        const colorKey = markersByCell.get(
          XLSX.utils.encode_cell({ r: row + shift.offset, c: columnOffset + 1 }),
        );
        if (colorKey) {
          markers.push({
            id: `${id}-marker`,
            scheduleId: month.scheduleId,
            shiftDate,
            kind: shift.kind,
            slot: shift.slot,
            colorKey,
          });
        }
      }
    }
  }

  return { assignments, markers, unknownNames };
}

async function main() {
  const db = getDb();
  const workbook = XLSX.readFile(SOURCE_FILE, { cellStyles: true, cellNF: true });
  const markerColorsBySheet = readMarkerColorsByCell(workbook);
  const existingDoctors = await db.select().from(doctors);
  const doctorsByShortName = new Map(
    existingDoctors.map((doctor) => [normalizeName(doctor.shortName), doctor.id]),
  );

  const existingFierro = existingDoctors.find(
    (doctor) => normalizeName(doctor.shortName) === "FIERRO",
  );
  if (existingFierro && !DRY_RUN) {
    await db
      .update(doctors)
      .set({
        shortName: "FIERRO",
        longName: "Esteban Fierro",
        active: true,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(doctors.id, existingFierro.id));
    doctorsByShortName.set("FIERRO", existingFierro.id);
  } else if (!existingFierro && !DRY_RUN) {
    await db.insert(doctors).values({
      id: "fierro",
      shortName: "FIERRO",
      longName: "Esteban Fierro",
      active: true,
      sortOrder: existingDoctors.length,
    });
    doctorsByShortName.set("FIERRO", "fierro");
  } else {
    doctorsByShortName.set("FIERRO", existingFierro?.id ?? "fierro");
  }

  const parsed = MONTHS.map((month) => {
    const sheet = workbook.Sheets[month.sheetName];
    if (!sheet) throw new Error(`No se encontró la hoja ${month.sheetName}`);
    return {
      month,
      ...parseMonth(sheet, month, doctorsByShortName, markerColorsBySheet.get(month.sheetName) ?? new Map()),
    };
  });

  const unknownNames = [...new Set(parsed.flatMap((item) => [...item.unknownNames]))];
  if (unknownNames.length) {
    throw new Error(`Médicos sin equivalencia: ${unknownNames.join(", ")}`);
  }

  if (DRY_RUN) {
    const verifiedFierro = await db
      .select()
      .from(doctors)
      .where(eq(doctors.shortName, "FIERRO"));
    console.log(
      verifiedFierro.length === 1
        ? `Médico FIERRO: ${verifiedFierro[0].longName} · ${verifiedFierro[0].active ? "activo" : "inactivo"}.`
        : `Advertencia: se encontraron ${verifiedFierro.length} registros FIERRO.`,
    );
    const existingAssignments = await db
      .select()
      .from(shiftAssignments)
      .where(inArray(shiftAssignments.scheduleId, MONTHS.map((month) => month.scheduleId)));
    const existingMarkers = await db
      .select()
      .from(shiftMarkers)
      .where(inArray(shiftMarkers.scheduleId, MONTHS.map((month) => month.scheduleId)));
    for (const item of parsed) {
      const currentAssignments = existingAssignments.filter(
        (assignment) => assignment.scheduleId === item.month.scheduleId,
      );
      const currentMarkers = existingMarkers.filter(
        (marker) => marker.scheduleId === item.month.scheduleId,
      );
      const assignmentSignature = (assignment: ParsedAssignment | (typeof existingAssignments)[number]) =>
        `${assignment.shiftDate}|${assignment.kind}|${assignment.slot}|${assignment.doctorId}`;
      const markerSignature = (marker: ParsedMarker | (typeof existingMarkers)[number]) =>
        `${marker.shiftDate}|${marker.kind}|${marker.slot}|${marker.colorKey}`;
      const currentAssignmentSet = new Set(currentAssignments.map(assignmentSignature));
      const nextAssignmentSet = new Set(item.assignments.map(assignmentSignature));
      const currentMarkerSet = new Set(currentMarkers.map(markerSignature));
      const nextMarkerSet = new Set(item.markers.map(markerSignature));
      console.log(
        `${item.month.scheduleId}: ${item.assignments.length} turnos (${[...nextAssignmentSet].filter((value) => !currentAssignmentSet.has(value)).length} nuevos/cambiados, ${[...currentAssignmentSet].filter((value) => !nextAssignmentSet.has(value)).length} retirados/cambiados) · ${item.markers.length} colores (${[...nextMarkerSet].filter((value) => !currentMarkerSet.has(value)).length} nuevos/cambiados, ${[...currentMarkerSet].filter((value) => !nextMarkerSet.has(value)).length} retirados/cambiados).`,
      );
    }
    return;
  }

  const schedules = await db
    .select()
    .from(scheduleMonths)
    .where(inArray(scheduleMonths.id, MONTHS.map((month) => month.scheduleId)));
  const schedulesById = new Map(schedules.map((schedule) => [schedule.id, schedule]));

  for (const item of parsed) {
    const schedule = schedulesById.get(item.month.scheduleId);
    if (!schedule) throw new Error(`No existe el calendario ${item.month.scheduleId}`);

    await db.delete(shiftMarkers).where(eq(shiftMarkers.scheduleId, item.month.scheduleId));
    await db.delete(shiftAssignments).where(eq(shiftAssignments.scheduleId, item.month.scheduleId));
    await db.insert(shiftAssignments).values(item.assignments);
    if (item.markers.length) await db.insert(shiftMarkers).values(item.markers);
    await db
      .update(scheduleMonths)
      .set({ version: schedule.version + 1, updatedAt: new Date() })
      .where(eq(scheduleMonths.id, item.month.scheduleId));
    await db.insert(auditEvents).values({
      action: "import",
      entityType: "schedule_month",
      entityId: item.month.scheduleId,
      actor: "importación Excel",
      after: {
        source: SOURCE_FILE.split("/").at(-1) ?? SOURCE_FILE,
        sheet: item.month.sheetName,
        assignments: item.assignments.length,
        markers: item.markers.length,
      },
    });
  }

  for (const legend of LEGENDS) {
    await db
      .update(shiftColorLegend)
      .set({ label: legend.label, updatedAt: new Date() })
      .where(eq(shiftColorLegend.colorKey, legend.colorKey));
  }

  for (const item of parsed) {
    console.log(
      `${item.month.scheduleId}: ${item.assignments.length} turnos y ${item.markers.length} marcas de color.`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
