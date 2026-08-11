import type { CSSProperties } from "react";
import type { ShiftColorKey, ShiftColorLegendItem } from "@/lib/types";

export const SHIFT_COLOR_KEYS: ShiftColorKey[] = [
  "yellow",
  "sky",
  "orange",
  "coral",
  "rose",
  "violet",
  "indigo",
  "teal",
  "lime",
  "slate",
];

export const DEFAULT_SHIFT_COLOR_LEGEND: ShiftColorLegendItem[] = [
  { key: "yellow", label: "Amarillo" },
  { key: "sky", label: "Celeste" },
  { key: "orange", label: "Naranjo" },
  { key: "coral", label: "Coral" },
  { key: "rose", label: "Rosado" },
  { key: "violet", label: "Violeta" },
  { key: "indigo", label: "Índigo" },
  { key: "teal", label: "Turquesa" },
  { key: "lime", label: "Lima" },
  { key: "slate", label: "Grafito" },
];

export function shiftColorStyle(colorKey?: ShiftColorKey): CSSProperties | undefined {
  if (!colorKey) return undefined;
  return {
    backgroundColor: `var(--shift-mark-${colorKey})`,
    color: `var(--shift-mark-${colorKey}-text)`,
  };
}
