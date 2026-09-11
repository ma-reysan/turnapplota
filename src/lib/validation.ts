import { z } from "zod";

export const shiftColorKeySchema = z.enum([
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
]);

export const assignmentSchema = z.object({
  id: z.string().min(1),
  date: z.iso.date(),
  kind: z.enum(["DAY", "NIGHT"]),
  slot: z.number().int().min(1).max(3),
  doctorId: z.string().min(1),
});

export const shiftMarkerSchema = z.object({
  id: z.string().min(1),
  date: z.iso.date(),
  kind: z.enum(["DAY", "NIGHT"]),
  slot: z.number().int().min(1).max(3),
  colorKey: shiftColorKeySchema,
});

export const scheduleUpdateSchema = z
  .object({
    id: z.string().regex(/^\d{4}-\d{2}$/),
    version: z.number().int().positive(),
    publish: z.boolean().default(false),
    assignments: z.array(assignmentSchema),
    markers: z.array(shiftMarkerSchema).default([]),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    for (const assignment of value.assignments) {
      if (assignment.kind === "NIGHT" && assignment.slot > 2) {
        context.addIssue({
          code: "custom",
          message: "La noche admite solo dos médicos",
        });
      }
      const key = `${assignment.date}-${assignment.kind}-${assignment.slot}`;
      if (seen.has(key)) {
        context.addIssue({ code: "custom", message: `Slot duplicado: ${key}` });
      }
      seen.add(key);
    }
    const seenMarkers = new Set<string>();
    for (const marker of value.markers) {
      if (marker.kind === "NIGHT" && marker.slot > 2) {
        context.addIssue({ code: "custom", message: "La noche admite solo dos médicos" });
      }
      const key = `${marker.date}-${marker.kind}-${marker.slot}`;
      if (seenMarkers.has(key)) {
        context.addIssue({ code: "custom", message: `Color duplicado: ${key}` });
      }
      seenMarkers.add(key);
    }
  });


const scheduleSlotSchema = z.object({
  date: z.iso.date(),
  kind: z.enum(["DAY", "NIGHT"]),
  slot: z.number().int().min(1).max(3),
});

export const schedulePatchSchema = z.object({
  id: z.string().regex(/^\d{4}-\d{2}$/),
  publish: z.boolean().optional(),
  assignments: z.array(scheduleSlotSchema.extend({ doctorId: z.string().min(1).nullable() })).default([]),
  markers: z.array(scheduleSlotSchema.extend({ colorKey: shiftColorKeySchema.nullable() })).default([]),
}).superRefine((value, context) => {
  for (const item of [...value.assignments, ...value.markers]) {
    if (item.kind === "NIGHT" && item.slot > 2) {
      context.addIssue({ code: "custom", message: "La noche admite solo dos médicos" });
    }
  }
});

export const shiftColorLegendSchema = z.object({
  items: z.array(
    z.object({
      key: shiftColorKeySchema,
      label: z.string().trim().min(1).max(60),
    }),
  ).length(10),
});

export const doctorInputSchema = z.object({
  id: z.string().min(1),
  shortName: z.string().trim().min(2).max(20),
  longName: z.string().trim().min(2).max(100),
  active: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const replacementInputSchema = z.object({
  id: z.string().min(1),
  date: z.iso.date(),
  doctorId: z.string().min(1),
  typeCode: z.string().min(1),
  points: z.number().int().min(0).max(20),
  mode: z.enum(["voluntary", "invoked"]),
  superhero: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
});

export const holidayInputSchema = z.object({
  date: z.iso.date(),
  label: z.string().trim().max(100).optional(),
});

export const protocolInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(160),
  url: z.url().refine((value) => /^https?:\/\//i.test(value), {
    message: "El enlace debe comenzar con http:// o https://",
  }),
  category: z.enum(["clinical", "surgery", "neurology", "pediatrics", "ophthalmology", "ent", "aps_network", "quality", "quality_dp", "quality_cal", "quality_gcl", "quality_aoc", "quality_rh", "quality_reg", "quality_eq", "quality_ins", "quality_apl", "quality_apf", "quality_ape", "quality_apt", "quality_apa", "quality_api", "quality_apk", "quality_aptr", "quality_gd"]),
  updatedBy: z.string().trim().min(2).max(80),
});

export const protocolDeleteSchema = z.object({
  id: z.string().uuid(),
  updatedBy: z.string().trim().min(2).max(80),
});

const phoneEstablishmentSchema = z.enum(["lota", "coronel", "regional"]);

export const phoneContactInputSchema = z.object({
  id: z.string().uuid().optional(),
  establishment: phoneEstablishmentSchema,
  service: z.string().trim().min(2).max(160),
  phones: z.array(z.string().trim().regex(/^[0-9+() -]{3,30}$/, "Cada número debe contener solo dígitos y símbolos telefónicos")).min(1, "Agrega al menos un número").max(12),
});

export const phoneContactDeleteSchema = z.object({
  id: z.string().uuid(),
});

export const agendaContributorSchema = z.object({
  updatedBy: z.string().trim().min(2).max(80),
});


const generatorParticipantSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().max(100),
  speed: z.enum(["fast", "medium", "slow"]),
  lane: z.number().int().min(0).max(5),
});

export const generatorSettingsSchema = z.object({
  id: z.literal("default"),
  version: z.number().int().positive(),
  lanes: z.array(z.object({
    id: z.string().min(1).max(40),
    label: z.string().trim().min(1).max(4),
    members: z.array(generatorParticipantSchema).length(3),
  })).length(6),
  wildcard: z.object({
    id: z.string().min(1).max(80),
    name: z.string().trim().max(100),
    target: z.literal(5),
    max: z.literal(6),
  }),
});

const generatorAbsenceSchema = z.object({
  id: z.string().min(1).max(100),
  participantId: z.string().min(1).max(80),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  kind: z.enum(["DAY", "NIGHT", "BOTH"]),
  note: z.string().trim().max(300).optional(),
}).refine((value) => value.startDate <= value.endDate, {
  message: "La fecha final de la ausencia debe ser igual o posterior a la inicial.",
});

const generatorBalanceSchema = z.object({
  participantId: z.string().min(1).max(80),
  total: z.number().int().min(-100).max(100),
  night: z.number().int().min(-100).max(100),
  weekend: z.number().int().min(-100).max(100),
});

const generatorAssignmentSchema = z.object({
  id: z.string().min(1).max(160),
  date: z.iso.date(),
  kind: z.enum(["DAY", "NIGHT"]),
  slot: z.number().int().min(1).max(3),
  participantId: z.string().min(1).max(80).nullable(),
  source: z.enum(["rotation", "replacement", "wildcard", "generated", "manual"]),
}).superRefine((value, context) => {
  if (value.kind === "NIGHT" && value.slot > 2) {
    context.addIssue({ code: "custom", message: "La noche admite solo dos médicos." });
  }
});

const generatorWarningSchema = z.object({
  code: z.string().min(1).max(80),
  message: z.string().min(1).max(500),
  date: z.iso.date().optional(),
  assignmentIds: z.array(z.string().min(1).max(160)).optional(),
});

export const generatorMonthSchema = z.object({
  id: z.string().regex(/^\d{4}-\d{2}$/),
  year: z.number().int().min(2020).max(2200),
  month: z.number().int().min(1).max(12),
  startLane: z.number().int().min(0).max(5),
  absences: z.array(generatorAbsenceSchema).max(300),
  balances: z.array(generatorBalanceSchema).max(19),
  assignments: z.array(generatorAssignmentSchema).max(160),
  generatedNotes: z.string().max(30000),
  manualNotes: z.string().max(10000),
  warnings: z.array(generatorWarningSchema).max(500),
  version: z.number().int().positive(),
}).superRefine((value, context) => {
  const expectedId = String(value.year) + "-" + String(value.month).padStart(2, "0");
  if (value.id !== expectedId) {
    context.addIssue({ code: "custom", message: "El identificador no coincide con el mes." });
  }
  const seen = new Set<string>();
  for (const assignment of value.assignments) {
    const key = assignment.date + "-" + assignment.kind + "-" + assignment.slot;
    if (seen.has(key)) context.addIssue({ code: "custom", message: "Cupo duplicado: " + key });
    seen.add(key);
  }
});
