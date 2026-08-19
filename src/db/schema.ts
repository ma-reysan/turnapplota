import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const shiftKind = pgEnum("shift_kind", ["DAY", "NIGHT"]);
export const scheduleStatus = pgEnum("schedule_status", ["draft", "published"]);
export const replacementMode = pgEnum("replacement_mode", [
  "voluntary",
  "invoked",
  "legacy_unknown",
]);

export const doctors = pgTable(
  "doctors",
  {
    id: text("id").primaryKey(),
    shortName: text("short_name").notNull(),
    longName: text("long_name").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("doctors_short_name_unique").on(table.shortName)],
);

export const scheduleMonths = pgTable(
  "schedule_months",
  {
    id: text("id").primaryKey(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    status: scheduleStatus("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("schedule_year_month_unique").on(table.year, table.month)],
);

export const shiftAssignments = pgTable(
  "shift_assignments",
  {
    id: text("id").primaryKey(),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => scheduleMonths.id, { onDelete: "cascade" }),
    shiftDate: date("shift_date").notNull(),
    kind: shiftKind("kind").notNull(),
    slot: integer("slot").notNull(),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("shift_slot_unique").on(
      table.scheduleId,
      table.shiftDate,
      table.kind,
      table.slot,
    ),
  ],
);

export const shiftMarkers = pgTable(
  "shift_markers",
  {
    id: text("id").primaryKey(),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => scheduleMonths.id, { onDelete: "cascade" }),
    shiftDate: date("shift_date").notNull(),
    kind: shiftKind("kind").notNull(),
    slot: integer("slot").notNull(),
    colorKey: text("color_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("shift_marker_slot_unique").on(
      table.scheduleId,
      table.shiftDate,
      table.kind,
      table.slot,
    ),
  ],
);

export const shiftColorLegend = pgTable("shift_color_legend", {
  colorKey: text("color_key").primaryKey(),
  label: text("label").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const replacementTypes = pgTable("replacement_types", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
  defaultPoints: integer("default_points").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const replacements = pgTable("replacements", {
  id: text("id").primaryKey(),
  replacementDate: date("replacement_date").notNull(),
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  typeCode: text("type_code").notNull(),
  points: integer("points").notNull(),
  mode: replacementMode("mode").notNull(),
  superhero: boolean("superhero").notNull().default(false),
  note: text("note"),
  expiresAt: date("expires_at").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vacations = pgTable("vacations", {
  id: uuid("id").defaultRandom().primaryKey(),
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const holidays = pgTable("holidays", {
  holidayDate: date("holiday_date").primaryKey(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const protocolCategory = pgEnum("protocol_category", [
  "clinical",
  "surgery",
  "neurology",
  "pediatrics",
  "ophthalmology",
  "ent",
  "aps_network",
  "quality",
  "quality_dp",
  "quality_cal",
  "quality_gcl",
  "quality_aoc",
  "quality_rh",
  "quality_reg",
  "quality_eq",
  "quality_ins",
  "quality_apl",
  "quality_apf",
  "quality_ape",
  "quality_apt",
  "quality_apa",
  "quality_api",
  "quality_apk",
  "quality_aptr",
  "quality_gd",
]);

export const protocols = pgTable("protocols", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  category: protocolCategory("category").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apsAgendas = pgTable("aps_agendas", {
  id: uuid("id").defaultRandom().primaryKey(),
  blobUrl: text("blob_url").notNull(),
  blobPath: text("blob_path").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  actor: text("actor").notNull().default("jefatura"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authAttempts = pgTable("auth_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  identityHash: text("identity_hash").notNull(),
  successful: boolean("successful").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
