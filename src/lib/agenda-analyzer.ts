import * as XLSX from "xlsx";

const MONTHS_ES: Record<string, number> = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DIC: 11 };
export type AgendaActivity = { time: string; activity: string };
export type AgendaDoctor = { name: string; rowIdx: number };
export type AgendaDay = { col: number; label: string; date: string };
export type AgendaResult = { doctors: AgendaDoctor[]; doctorName: string; doctorRow: number; days: AgendaDay[]; schedule: Record<number, AgendaActivity[]> };

const normal = (value: unknown) => String(value ?? "").trim().toUpperCase();
const hasWeekdays = (row: unknown[]) => (row.slice(1).map(normal).join(" ").match(/\b(DOMINGO|LUNES|MARTES|MIERCOLES|MIÉRCOLES|JUEVES|VIERNES|SABADO|SÁBADO)\b/g) ?? []).length >= 3;

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

export function parseAgendaWorkbook(workbook: XLSX.WorkBook, sheetName: string, requestedRow?: number): AgendaResult | null {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const doctors = findAgendaDoctors(raw);
  if (!doctors.length) return null;
  const doctor = doctors.find((item) => item.rowIdx === requestedRow) ?? doctors[0];
  const header = raw[doctor.rowIdx] ?? [];
  const dateRow = raw[doctor.rowIdx - 1] ?? [];
  const days: AgendaDay[] = [];
  for (let col = 1; col < header.length; col += 1) {
    const label = String(header[col] ?? "").trim();
    if (!label) continue;
    const rawDate = dateRow[col];
    const date = typeof rawDate === "number"
      ? (() => { const value = XLSX.SSF.parse_date_code(rawDate); return value ? `${String(value.d).padStart(2, "0")}/${String(value.m).padStart(2, "0")}` : ""; })()
      : String(rawDate ?? "").trim();
    days.push({ col, label, date });
  }
  const schedule: Record<number, AgendaActivity[]> = Object.fromEntries(days.map((day) => [day.col, []]));
  raw.slice(doctor.rowIdx + 1, doctor.rowIdx + 13).forEach((row) => {
    const time = String(row[0] ?? "").trim();
    days.forEach(({ col }) => {
      let activity = String(row[col] ?? "").trim();
      if (!activity || activity === "-" || normal(activity) === "X") return;
      if (normal(activity) === "TURNO") activity = "TURNO DÍA";
      schedule[col].push({ time, activity });
    });
  });
  const night = raw[doctor.rowIdx + 13] ?? [];
  days.forEach(({ col }) => {
    const value = normal(night[col]);
    if (value.includes("TURNO") && (value.includes("20") || value.includes("NOCHE"))) schedule[col].push({ time: "20:00-08:00", activity: "TURNO NOCHE" });
  });
  return { doctors, doctorName: doctor.name, doctorRow: doctor.rowIdx, days, schedule };
}

export function mergeAgendaActivities(activities: AgendaActivity[]) {
  const day = activities.some((item) => item.activity === "TURNO DÍA");
  const night = activities.some((item) => item.activity === "TURNO NOCHE");
  const source = day && night ? activities.filter((item) => !item.activity.startsWith("TURNO")).concat({ time: "08:00-08:00", activity: "TURNO 24H" }) : activities;
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
  const match = value.match(/^(\d{1,2})[-\s]([A-Za-zÁÉÍÓÚáéíóú]{3,})/) ?? value.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const month = value.includes("/") ? Number(match[2]) - 1 : MONTHS_ES[match[2].slice(0, 3).toUpperCase()];
  return month === undefined ? null : new Date(new Date().getFullYear(), month, Number(match[1]));
}
