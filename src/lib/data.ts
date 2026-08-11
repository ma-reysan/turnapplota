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
  shiftColorLegend,
  shiftMarkers,
  vacations,
  holidays,
} from "@/db/schema";
import type { SeedData, ShiftColorKey } from "@/lib/types";
import { DEFAULT_SHIFT_COLOR_LEGEND } from "@/lib/shift-colors";

const seed = seedJson as SeedData;

export async function getAppData(): Promise<SeedData> {
  if (!isDatabaseConfigured()) {
    return {
      ...seed,
      schedules: seed.schedules.map((schedule) => ({ ...schedule, markers: schedule.markers ?? [] })),
      shiftColorLegend: seed.shiftColorLegend ?? DEFAULT_SHIFT_COLOR_LEGEND,
      vacations: seed.vacations ?? [],
      holidays: seed.holidays ?? [],
    };
  }

  await connection();
  const db = getDb();
  const [doctorRows, monthRows, assignmentRows, markerRows, legendRows, replacementRows, typeRows, vacationRows, holidayRows] =
    await Promise.all([
      db.select().from(doctors).where(isNull(doctors.deletedAt)).orderBy(asc(doctors.sortOrder)),
      db.select().from(scheduleMonths).orderBy(asc(scheduleMonths.id)),
      db.select().from(shiftAssignments).orderBy(asc(shiftAssignments.shiftDate)),
      db.select().from(shiftMarkers).orderBy(asc(shiftMarkers.shiftDate)),
      db.select().from(shiftColorLegend).orderBy(asc(shiftColorLegend.colorKey)),
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
      db.select().from(vacations).orderBy(asc(vacations.startDate)),
      db.select().from(holidays).orderBy(asc(holidays.holidayDate)),
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
      version: month.version,
      assignments: assignmentRows
        .filter((assignment) => assignment.scheduleId === month.id)
        .map((assignment) => ({
          id: assignment.id,
          date: assignment.shiftDate,
          kind: assignment.kind,
          slot: assignment.slot,
          doctorId: assignment.doctorId,
        })),
      markers: markerRows
        .filter((marker) => marker.scheduleId === month.id)
        .map((marker) => ({
          id: marker.id,
          date: marker.shiftDate,
          kind: marker.kind,
          slot: marker.slot,
          colorKey: marker.colorKey as ShiftColorKey,
        })),
    })),
    shiftColorLegend: DEFAULT_SHIFT_COLOR_LEGEND.map((fallback) => {
      const stored = legendRows.find((item) => item.colorKey === fallback.key);
      return stored ? { key: fallback.key, label: stored.label } : fallback;
    }),
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
    vacations: vacationRows.map((row) => ({
      id: row.id,
      doctorId: row.doctorId,
      startDate: row.startDate,
      endDate: row.endDate,
    })),
    holidays: holidayRows.map((row) => ({
      date: row.holidayDate,
      label: row.label ?? undefined,
    })),
  };
}
