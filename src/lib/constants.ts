import type { ReplacementType } from "@/lib/types";

export const REPLACEMENT_TYPES: ReplacementType[] = [
  { code: "DAY_MON", label: "Día lunes", defaultPoints: 3 },
  { code: "DAY_TUE_THU", label: "Día martes a jueves", defaultPoints: 2 },
  { code: "NIGHT_MON_THU", label: "Noche lunes a jueves", defaultPoints: 2 },
  { code: "DAY_FRI", label: "Día viernes", defaultPoints: 3 },
  { code: "NIGHT_FRI", label: "Noche viernes", defaultPoints: 3 },
  { code: "SAT_HOLIDAY_24", label: "Sábado o festivo (24 h)", defaultPoints: 7 },
  { code: "SAT_12", label: "Sábado (12 h)", defaultPoints: 3 },
  { code: "SUN_DAY", label: "Domingo día", defaultPoints: 3 },
  { code: "SUN_NIGHT", label: "Domingo noche", defaultPoints: 2 },
  { code: "HERO_12", label: "Superhéroe (12 h)", defaultPoints: 4 },
  { code: "HERO_24", label: "Superhéroe (24 h)", defaultPoints: 7 },
];

export const NAV_ITEMS = [
  { href: "/turnos", label: "Turnos", icon: "calendar" },
  { href: "/reemplazos", label: "Reemplazos", icon: "table" },
  { href: "/analisis", label: "Análisis", icon: "chart" },
  { href: "/jefatura", label: "Jefatura", icon: "lock" },
] as const;
