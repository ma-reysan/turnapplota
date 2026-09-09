export const ACCENT_THEME_OPTIONS = [
  { value: "green", label: "Verde (original)" },
  { value: "red", label: "Rojo" },
  { value: "blue", label: "Azul" },
  { value: "gold", label: "Dorado" },
  { value: "dieciocho", label: "Dieciocho" },
] as const;

export type AccentTheme = (typeof ACCENT_THEME_OPTIONS)[number]["value"];

export function isAccentTheme(value: string | null): value is AccentTheme {
  return ACCENT_THEME_OPTIONS.some((option) => option.value === value);
}

function chileDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
}

function chileDateKey(date: Date) {
  const { year, month, day } = chileDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function utcDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function weekRangeFor(year: number, month: number, day: number) {
  const target = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (target.getUTCDay() + 6) % 7;
  const monday = new Date(target.getTime() - mondayOffset * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return { start: utcDateKey(monday), end: utcDateKey(sunday) };
}

export function isDieciochoSeason(date = new Date()) {
  const { year } = chileDateParts(date);
  const today = chileDateKey(date);
  return [18, 19].some((day) => {
    const { start, end } = weekRangeFor(year, 9, day);
    return today >= start && today <= end;
  });
}
