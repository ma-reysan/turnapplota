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

export const vacationInputSchema = z
  .object({
    doctorId: z.string().min(1),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "La fecha de término debe ser posterior o igual al inicio",
    path: ["endDate"],
  });

export const holidayInputSchema = z.object({
  date: z.iso.date(),
  label: z.string().trim().max(100).optional(),
});
