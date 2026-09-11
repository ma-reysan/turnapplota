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


export type GeneratorLaneSpeed = "fast" | "medium" | "slow";
export type GeneratorAbsenceKind = "DAY" | "NIGHT" | "BOTH";
export type GeneratorAssignmentSource =
  | "rotation"
  | "replacement"
  | "wildcard"
  | "generated"
  | "manual";

export interface GeneratorParticipant {
  id: string;
  name: string;
  speed: GeneratorLaneSpeed;
  lane: number;
}

export interface GeneratorLane {
  id: string;
  label: string;
  members: GeneratorParticipant[];
}

export interface GeneratorWildcard {
  id: string;
  name: string;
  target: number;
  max: number;
}

export interface GeneratorSettings {
  id: "default";
  lanes: GeneratorLane[];
  wildcard: GeneratorWildcard;
  version: number;
}

export interface GeneratorBalance {
  participantId: string;
  total: number;
  night: number;
  weekend: number;
}

export interface GeneratorAbsence {
  id: string;
  participantId: string;
  startDate: string;
  endDate: string;
  kind: GeneratorAbsenceKind;
  note?: string;
}

export interface GeneratorAssignment {
  id: string;
  date: string;
  kind: ShiftKind;
  slot: number;
  participantId: string | null;
  source: GeneratorAssignmentSource;
}

export interface GeneratorMetric {
  participantId: string;
  total: number;
  night: number;
  weekend: number;
  projectedTotal: number;
  projectedNight: number;
  projectedWeekend: number;
}

export interface GeneratorWarning {
  code: string;
  message: string;
  date?: string;
  assignmentIds?: string[];
}

export interface GeneratorMonthDraft {
  id: string;
  year: number;
  month: number;
  startLane: number;
  absences: GeneratorAbsence[];
  balances: GeneratorBalance[];
  assignments: GeneratorAssignment[];
  generatedNotes: string;
  manualNotes: string;
  warnings: GeneratorWarning[];
  version: number;
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
