import * as XLSX from "xlsx";

const MONTHS_ES: Record<string, number> = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DIC: 11 };
export type AgendaActivity = { time: string; activity: string };
export type AgendaDoctor = { name: string; rowIdx: number };
export type AgendaDay = { col: number; label: string; date: string };
export type AgendaResult = { doctors: AgendaDoctor[]; doctorName: string; doctorRow: number; days: AgendaDay[]; schedule: Record<number, AgendaActivity[]>; warnings: string[] };

const normal = (value: unknown) => String(value ?? "").trim().toUpperCase();
const hasWeekdays = (row: unknown[]) => (row.slice(1).map(normal).join(" ").match(/\b(DOMINGO|LUNES|MARTES|MIERCOLES|MIÉRCOLES|JUEVES|VIERNES|SABADO|SÁBADO)\b/g) ?? []).length >= 3;
const isWeekday = (value: unknown) => /^(DOMINGO|LUNES|MARTES|MIÉRCOLES|MIERCOLES|JUEVES|VIERNES|SÁBADO|SABADO)\b/i.test(String(value ?? "").trim());

function validDateParts(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function formatAgendaDate(year: number, month: number, day: number) {
  if (!validDateParts(year, month, day)) return null;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function dateCellText(value: unknown) {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? formatAgendaDate(parsed.y, parsed.m, parsed.d) : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatAgendaDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const iso = text.match(/^(20\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return formatAgendaDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (numeric) {
    const year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : new Date().getFullYear();
    return formatAgendaDate(year, Number(numeric[2]), Number(numeric[1]));
  }
  const named = text.match(/^(\d{1,2})[-\s]([A-Za-zÁÉÍÓÚáéíóú]{3,})(?:[-\s]+(20\d{2}))?$/);
  if (named) {
    const month = MONTHS_ES[named[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3).toUpperCase()];
    return month === undefined ? null : formatAgendaDate(Number(named[3] ?? new Date().getFullYear()), month + 1, Number(named[1]));
  }
  return null;
}

export function findAgendaDoctors(raw: unknown[][]): AgendaDoctor[] {
  return raw.flatMap((row, rowIdx) => {
    const name = String(row[0] ?? "").trim();
    return name && hasWeekdays(row) ? [{ name, rowIdx }] : [];
  }).sort((a, b) => {
    const isMauricioReyes = (name: string) => {
      const compact = normal(name).replace(/[^A-Z]/g, "");
      return compact === "DRREYES" || compact === "DRMAURICIOREYES" || compact === "MAURICIOREYES";
    };
    if (isMauricioReyes(a.name) !== isMauricioReyes(b.name)) return isMauricioReyes(a.name) ? -1 : 1;
    return a.name.localeCompare(b.name, "es");
  });
}

function isExcelDateSerial(value: unknown) {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d{5}$/.test(value.trim()))) return false;
  const serial = Number(value);
  if (serial < 20000 || serial > 80000) return false;
  const parsed = XLSX.SSF.parse_date_code(serial);
  return Boolean(parsed && validDateParts(parsed.y, parsed.m, parsed.d));
}

export function parseAgendaWorkbook(workbook: XLSX.WorkBook, sheetName: string, requestedRow?: number): AgendaResult | null {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: true });
  const doctors = findAgendaDoctors(raw);
  if (!doctors.length) return null;
  const doctor = doctors.find((item) => item.rowIdx === requestedRow) ?? doctors[0];
  const header = raw[doctor.rowIdx] ?? [];
  const columns = header.flatMap((value, col) => col > 0 && isWeekday(value) ? [col] : []);
  const precedingRows = Array.from({ length: Math.min(5, doctor.rowIdx) }, (_, index) => doctor.rowIdx - index - 1);
  const dateRowIdx = precedingRows
    .map((rowIdx) => ({ rowIdx, matches: columns.filter((col) => dateCellText(raw[rowIdx]?.[col])).length }))
    .sort((a, b) => b.matches - a.matches || b.rowIdx - a.rowIdx)[0]?.rowIdx;
  const dateRow = dateRowIdx === undefined ? [] : raw[dateRowIdx] ?? [];
  const days: AgendaDay[] = [];
  const warnings: string[] = [];
  for (const col of columns) {
    const label = String(header[col] ?? "").trim();
    const rawDate = dateCellText(dateRow[col]);
    const date = rawDate ?? String(dateRow[col] ?? "").trim();
    if (!rawDate) warnings.push(`No se pudo interpretar la fecha de la columna ${XLSX.utils.encode_col(col)} (${label || "día sin nombre"}).`);
    days.push({ col, label, date });
  }
  const schedule: Record<number, AgendaActivity[]> = Object.fromEntries(days.map((day) => [day.col, []]));
  const nextDoctorRow = doctors.filter((item) => item.rowIdx > doctor.rowIdx).reduce((minimum, item) => Math.min(minimum, item.rowIdx), raw.length);
  raw.slice(doctor.rowIdx + 1, nextDoctorRow).forEach((row, offset) => {
    const time = String(row[0] ?? "").trim();
    const hasTime = /\b\d{1,2}:\d{2}\b/.test(time);
    const rowHasContent = days.some(({ col }) => String(row[col] ?? "").trim() && String(row[col]).trim() !== "-" && !isExcelDateSerial(row[col]));
    const isNightRecord = !hasTime && days.some(({ col }) => /TURNO/.test(normal(row[col])) && /(NOCHE|20\s*:?\s*00|20\s*[-–]\s*0?8)/.test(normal(row[col])));
    if (!hasTime && !rowHasContent) return;
    days.forEach(({ col }) => {
      let activity = String(row[col] ?? "").trim();
      if (!activity || activity === "-" || normal(activity) === "X" || isExcelDateSerial(row[col])) return;
      if (!hasTime && /TURNO/.test(normal(activity)) && /(NOCHE|20\s*:?\s*00|20\s*[-–]\s*0?8)/.test(normal(activity))) {
        schedule[col].push({ time: "20:00-08:00", activity: "TURNO NOCHE" });
        return;
      }
      if (normal(activity) === "TURNO") activity = "TURNO DÍA";
      schedule[col].push({ time, activity });
    });
    if (!hasTime && rowHasContent && !isNightRecord) warnings.push(`Se conservaron actividades de la fila ${doctor.rowIdx + offset + 2}, pero no se reconoció su horario.`);
  });
  return { doctors, doctorName: doctor.name, doctorRow: doctor.rowIdx, days, schedule, warnings: [...new Set(warnings)] };
}

export function mergeAgendaActivities(activities: AgendaActivity[]) {
  const normalizeShift = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  const isDayShift = (item: AgendaActivity) => normalizeShift(item.activity) === "TURNO DIA";
  const isNightShift = (item: AgendaActivity) => normalizeShift(item.activity) === "TURNO NOCHE";
  const day = activities.some(isDayShift);
  const night = activities.some(isNightShift);
  const source = day && night
    ? activities.filter((item) => !isDayShift(item) && !isNightShift(item)).concat({ time: "08:00-08:00", activity: "TURNO 24H" })
    : activities;
  return source.reduce<AgendaActivity[]>((all, item) => {
    const previous = all.at(-1);
    const [start, end] = item.time.split("-").map((value) => value.trim());
    if (previous && previous.activity === item.activity && previous.time.split("-")[1]?.trim() === start) {
      previous.time = `${previous.time.split("-")[0]?.trim()}-${end}`;
    } else all.push({ ...item });
    return all;
  }, []);
}

export function agendaDate(value: string) {
  const text = value.trim();
  const iso = text.match(/^(20\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return validDateParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (numeric) {
    const year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : new Date().getFullYear();
    return validDateParts(year, Number(numeric[2]), Number(numeric[1]));
  }
  const named = text.match(/^(\d{1,2})[-\s]([A-Za-zÁÉÍÓÚáéíóú]{3,})(?:[-\s]+(20\d{2}))?$/);
  if (!named) return null;
  const month = MONTHS_ES[named[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3).toUpperCase()];
  return month === undefined ? null : validDateParts(Number(named[3] ?? new Date().getFullYear()), month + 1, Number(named[1]));
}
