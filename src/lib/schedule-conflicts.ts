import { addDays, format } from "date-fns";
import type { ShiftAssignment } from "@/lib/types";

export interface NightToDayConflict {
  doctorId: string;
  nightDate: string;
  dayDate: string;
}

function nextDate(date: string) {
  return format(addDays(new Date(`${date}T12:00:00`), 1), "yyyy-MM-dd");
}

/**
 * Detects a clinically incompatible transition: a NIGHT shift followed by a
 * DAY shift on the immediately following calendar day for the same doctor.
 * Slots are deliberately ignored here: any such pairing needs review.
 */
export function findNightToDayConflicts(assignments: ShiftAssignment[]): NightToDayConflict[] {
  const dayAssignments = new Set(
    assignments
      .filter((assignment) => assignment.kind === "DAY")
      .map((assignment) => `${assignment.doctorId}:${assignment.date}`),
  );
  const conflicts = new Map<string, NightToDayConflict>();

  for (const assignment of assignments) {
    if (assignment.kind !== "NIGHT") continue;
    const dayDate = nextDate(assignment.date);
    if (!dayAssignments.has(`${assignment.doctorId}:${dayDate}`)) continue;
    const key = `${assignment.doctorId}:${assignment.date}`;
    conflicts.set(key, { doctorId: assignment.doctorId, nightDate: assignment.date, dayDate });
  }

  return [...conflicts.values()].sort((first, second) =>
    first.nightDate.localeCompare(second.nightDate) || first.doctorId.localeCompare(second.doctorId),
  );
}

export function incompatibleAssignmentIds(
  assignments: ShiftAssignment[],
  conflicts: NightToDayConflict[],
) {
  const affected = new Set<string>();
  for (const conflict of conflicts) {
    for (const assignment of assignments) {
      const isNight = assignment.doctorId === conflict.doctorId
        && assignment.kind === "NIGHT"
        && assignment.date === conflict.nightDate;
      const isDay = assignment.doctorId === conflict.doctorId
        && assignment.kind === "DAY"
        && assignment.date === conflict.dayDate;
      if (isNight || isDay) affected.add(assignment.id);
    }
  }
  return affected;
}
