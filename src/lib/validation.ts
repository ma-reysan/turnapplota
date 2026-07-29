import { z } from "zod";

export const assignmentSchema = z.object({
  id: z.string().min(1),
  date: z.iso.date(),
  kind: z.enum(["DAY", "NIGHT"]),
  slot: z.number().int().min(1).max(3),
  doctorId: z.string().min(1),
});

export const scheduleUpdateSchema = z
  .object({
    id: z.string().regex(/^\d{4}-\d{2}$/),
    version: z.number().int().positive(),
    publish: z.boolean().default(false),
    assignments: z.array(assignmentSchema),
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
