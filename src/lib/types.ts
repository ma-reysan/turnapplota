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

export interface ScheduleMonth {
  id: string;
  year: number;
  month: number;
  status: ScheduleStatus;
  assignments: ShiftAssignment[];
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
  expiresAt: string;
  note?: string;
}

export interface SeedData {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  replacements: Replacement[];
  replacementTypes: ReplacementType[];
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
