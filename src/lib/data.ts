import { asc, desc, eq, isNull } from "drizzle-orm";
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
  holidays,
  apsAgendas,
  protocols,
} from "@/db/schema";
import type { SeedData, ShiftColorKey } from "@/lib/types";
import { DEFAULT_SHIFT_COLOR_LEGEND } from "@/lib/shift-colors";
import { DRIVE_PROTOCOL_CATALOG } from "@/lib/drive-protocol-catalog";

const seed = seedJson as SeedData;

export async function getAppData(): Promise<SeedData> {
  if (!isDatabaseConfigured()) {
    return {
      ...seed,
      schedules: seed.schedules.map((schedule) => ({ ...schedule, markers: schedule.markers ?? [] })),
      shiftColorLegend: seed.shiftColorLegend ?? DEFAULT_SHIFT_COLOR_LEGEND,
      holidays: seed.holidays ?? [],
      protocols: [
        ...(seed.protocols ?? []).filter((item) => !DRIVE_PROTOCOL_CATALOG.some((catalog) => catalog.url === item.url)),
        ...DRIVE_PROTOCOL_CATALOG.map((item, index) => ({
          ...item,
          id: `drive-${index}`,
          updatedBy: "Biblioteca de Drive",
          updatedAt: "2026-08-19T00:00:00.000Z",
        })),
      ],
      apsAgenda: seed.apsAgenda,
    };
  }

  await connection();
  const db = getDb();
  const [doctorRows, monthRows, assignmentRows, markerRows, legendRows, replacementRows, typeRows, holidayRows, protocolRows, agendaRows] =
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
      db.select().from(holidays).orderBy(asc(holidays.holidayDate)),
      db.select().from(protocols).orderBy(asc(protocols.category), asc(protocols.title)),
      db
        .select()
        .from(apsAgendas)
        .where(isNull(apsAgendas.archivedAt))
        .orderBy(desc(apsAgendas.createdAt))
        .limit(1),
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
    lastInvokedDoctorId:
      [...replacementRows]
        .reverse()
        .find((replacement) => replacement.mode === "invoked")?.doctorId ??
      seed.lastInvokedDoctorId,
    replacementTypes: typeRows.map((row) => ({
      code: row.code,
      label: row.label,
      defaultPoints: row.defaultPoints,
    })),
    holidays: holidayRows.map((row) => ({
      date: row.holidayDate,
      label: row.label ?? undefined,
    })),
    protocols: protocolRows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      category: row.category,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt.toISOString(),
    })),
    apsAgenda: agendaRows[0]
      ? {
          id: agendaRows[0].id,
          filename: agendaRows[0].filename,
          updatedBy: agendaRows[0].updatedBy,
          updatedAt: agendaRows[0].createdAt.toISOString(),
        }
      : undefined,
  };
}
