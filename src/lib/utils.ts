import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number) {
  return format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: es });
}

export function calendarDays(year: number, month: number) {
  const first = startOfWeek(startOfMonth(new Date(year, month - 1)), {
    weekStartsOn: 1,
  });
  const final = endOfMonth(new Date(year, month - 1));
  const days: Date[] = [];
  let cursor = first;
  while (days.length < 42) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
    if (cursor > final && cursor.getDay() === 1 && days.length >= 35) break;
  }
  return days;
}

// Los títulos llevan tildes pero nadie las escribe al buscar, así que
// comparamos sin diacríticos ni mayúsculas.
export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function normalizeDoctorSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-CL")
    .trim();
}

// El servidor y el navegador usan versiones distintas de ICU: una emite espacio
// normal antes de "p. m." y la otra un espacio fino (U+202F). Fijamos la zona
// horaria y unificamos los espacios para que ambos rendericen igual y React no
// reporte un error de hidratación.
export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago",
  })
    .format(new Date(value))
    .replace(/[  ]/g, " ");
}

export function isActiveReplacement(date: string, today = new Date()) {
  const expiry = addDays(new Date(`${date}T12:00:00`), 120);
  return expiry >= today;
}
