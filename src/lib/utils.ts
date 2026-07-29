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

export function normalizeDoctorSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-CL")
    .trim();
}

export function isActiveReplacement(date: string, today = new Date()) {
  const expiry = addDays(new Date(`${date}T12:00:00`), 120);
  return expiry >= today;
}
