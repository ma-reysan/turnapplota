import { asc, eq, isNull } from "drizzle-orm";
import { connection } from "next/server";
import seedJson from "@/data/seed.json";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  doctors,
  replacementTypes,
  replacements,
  scheduleMonths,
  shiftAssignments,
} from "@/db/schema";
import type { SeedData } from "@/lib/types";

const seed = seedJson as SeedData;

export async function getAppData(): Promise<SeedData> {
  if (!isDatabaseConfigured()) return seed;

  await connection();
  const db = getDb();
  const [doctorRows, monthRows, assignmentRows, replacementRows, typeRows] =
    await Promise.all([
      db.select().from(doctors).where(isNull(doctors.deletedAt)).orderBy(asc(doctors.sortOrder)),
      db.select().from(scheduleMonths).orderBy(asc(scheduleMonths.id)),
      db.select().from(shiftAssignments).orderBy(asc(shiftAssignments.shiftDate)),
      db
        .select()
        .from(replacements)
        .where(isNull(replacements.deletedAt))
        .orderBy(asc(replacements.replacementDate)),
      db
        .select()
        .from(replacementTypes)
        .where(eq(replacementTypes.active, true))
        .orderBy(asc(replacementTypes.sortOrder)),
    ]);

  return {
    ...seed,
    doctors: doctorRows.map((row) => ({
      id: row.id,
      shortName: row.shortName,
      longName: row.longName,
      active: row.active,
      sortOrder: row.sortOrder,
    })),
    schedules: monthRows.map((month) => ({
      id: month.id,
      year: month.year,
      month: month.month,
      status: month.status,
      assignments: assignmentRows
        .filter((assignment) => assignment.scheduleId === month.id)
        .map((assignment) => ({
          id: assignment.id,
          date: assignment.shiftDate,
          kind: assignment.kind,
          slot: assignment.slot,
          doctorId: assignment.doctorId,
        })),
    })),
    replacements: replacementRows.map((row) => ({
      id: row.id,
      date: row.replacementDate,
      doctorId: row.doctorId,
      typeCode: row.typeCode,
      points: row.points,
      mode: row.mode,
      superhero: row.superhero,
      expiresAt: row.expiresAt,
      note: row.note ?? undefined,
    })),
    replacementTypes: typeRows.map((row) => ({
      code: row.code,
      label: row.label,
      defaultPoints: row.defaultPoints,
    })),
  };
}
