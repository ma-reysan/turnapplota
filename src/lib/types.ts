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

export interface Holiday {
  date: string;
  label?: string;
}

export type ProtocolCategory =
  | "clinical"
  | "surgery"
  | "neurology"
  | "pediatrics"
  | "ophthalmology"
  | "ent"
  | "aps_network"
  | "quality"
  | "quality_dp"
  | "quality_cal"
  | "quality_gcl"
  | "quality_aoc"
  | "quality_rh"
  | "quality_reg"
  | "quality_eq"
  | "quality_ins"
  | "quality_apl"
  | "quality_apf"
  | "quality_ape"
  | "quality_apt"
  | "quality_apa"
  | "quality_api"
  | "quality_apk"
  | "quality_aptr"
  | "quality_gd";

export interface Protocol {
  id: string;
  title: string;
  url: string;
  category: ProtocolCategory;
  updatedBy: string;
  updatedAt: string;
}

export type PhoneEstablishment = "lota" | "coronel" | "regional";

export interface PhoneContact {
  id: string;
  establishment: PhoneEstablishment;
  service: string;
  phones: string[];
  sourceNeedsReview: boolean;
  updatedAt: string;
}

export interface LunchMenu {
  id: string;
  menuDate: string;
  content: string;
  sourceUrl: string;
  fetchedAt: string;
}

export interface ApsAgenda {
  id: string;
  filename: string;
  updatedBy: string;
  updatedAt: string;
}

export interface SeedData {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  shiftColorLegend: ShiftColorLegendItem[];
  replacements: Replacement[];
  replacementTypes: ReplacementType[];
  holidays: Holiday[];
  protocols: Protocol[];
  apsAgenda?: ApsAgenda;
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
