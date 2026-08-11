export type ShiftKind = "DAY" | "NIGHT";
export type ScheduleStatus = "draft" | "published";
export type ReplacementMode = "voluntary" | "invoked" | "legacy_unknown";

export interface Doctor {
  id: string;
  shortName: string;
  longName: string;
  active: boolean;
  sortOrder: number;
}

export interface ShiftAssignment {
  id: string;
  date: string;
  kind: ShiftKind;
  slot: number;
  doctorId: string;
}

export type ShiftColorKey =
  | "yellow"
  | "sky"
  | "orange"
  | "coral"
  | "rose"
  | "violet"
  | "indigo"
  | "teal"
  | "lime"
  | "slate";

export interface ShiftMarker {
  id: string;
  date: string;
  kind: ShiftKind;
  slot: number;
  colorKey: ShiftColorKey;
}

export interface ShiftColorLegendItem {
  key: ShiftColorKey;
  label: string;
}

export interface ScheduleMonth {
  id: string;
  year: number;
  month: number;
  status: ScheduleStatus;
  version?: number;
  assignments: ShiftAssignment[];
  markers?: ShiftMarker[];
}

export interface ReplacementType {
  code: string;
  label: string;
  defaultPoints: number;
}

export interface Replacement {
  id: string;
  date: string;
  doctorId: string;
  typeCode: string;
  points: number;
  mode: ReplacementMode;
  superhero: boolean;
  expiresAt: string;
  note?: string;
}

export interface Vacation {
  id: string;
  doctorId: string;
  startDate: string;
  endDate: string;
}

export interface Holiday {
  date: string;
  label?: string;
}

export interface SeedData {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  shiftColorLegend: ShiftColorLegendItem[];
  replacements: Replacement[];
  replacementTypes: ReplacementType[];
  vacations: Vacation[];
  holidays: Holiday[];
  pearls: string[];
  lastInvokedDoctorId?: string;
  migration: {
    generatedAt: string;
    scheduleSheets: number;
    assignments: number;
    replacements: number;
    warnings: string[];
  };
}
