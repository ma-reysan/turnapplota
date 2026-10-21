import { getDb, isDatabaseConfigured } from "@/db";
import { baseCorrections, doctorAbsences, onCallWeeks, pointFreezes } from "@/db/schema";
import { manualOnCallWeek, prepareOnCallWeeks } from "@/lib/november-system";
import type { BaseCorrection, DoctorAbsence, OnCallWeek, PointFreeze } from "@/lib/november-system";
import type { SeedData } from "@/lib/types";

export interface NovemberData {
  onCallWeeks: OnCallWeek[];
  absences: DoctorAbsence[];
  freezes: PointFreeze[];
  corrections: BaseCorrection[];
}

export async function readNovemberData(data: Pick<SeedData, "schedules">): Promise<NovemberData> {
  if (!isDatabaseConfigured()) {
    return { onCallWeeks: [], absences: [], freezes: [], corrections: [] };
  }
  const [weeks, absences, freezes, corrections] = await Promise.all([
    getDb().select().from(onCallWeeks),
    getDb().select().from(doctorAbsences),
    getDb().select().from(pointFreezes),
    getDb().select().from(baseCorrections),
  ]);
  const stored: OnCallWeek[] = weeks.map((item) => manualOnCallWeek({
    weekStart: item.weekStart,
    doctorIds: item.doctorIds,
    colorKeys: item.colorKeys,
    manual: item.manual, needsReview: item.needsReview,
  }));
  const absenceRows: DoctorAbsence[] = absences.map((item) => ({
    id: item.id, doctorId: item.doctorId, startDate: item.startDate,
    endDate: item.endDate, reason: item.reason as DoctorAbsence["reason"],
    note: item.note ?? undefined,
  }));
  const generated = data.schedules.filter((item) => item.id >= "2026-11")
    .sort((a, b) => a.id.localeCompare(b.id)).reduce((current, month) => {
      const next = prepareOnCallWeeks(month.id, current);
      return [...current, ...next.filter((week) =>
        !current.some((item) => item.weekStart === week.weekStart))];
    }, stored);
  return {
    onCallWeeks: generated.sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    absences: absenceRows,
    freezes: freezes.map((item) => ({
      id: item.id, doctorId: item.doctorId, startDate: item.startDate, endDate: item.endDate,
    })),
    corrections: corrections.map((item) => ({
      assignmentId: item.assignmentId, worked: item.worked, reason: item.reason,
    })),
  };
}
