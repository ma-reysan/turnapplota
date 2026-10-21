import { addDays, differenceInCalendarDays, format, startOfWeek } from "date-fns";
import type { Doctor, Replacement, ScheduleMonth, ShiftAssignment } from "@/lib/types";

export const NEW_SYSTEM_START = "2026-11-01";
const SANTIAGO = "America/Santiago";
const HOUR = 60 * 60 * 1000;

export interface OnCallWeek {
  weekStart: string;
  doctorIds: string[];
  manual: boolean;
  needsReview: boolean;
}
export interface DoctorAbsence {
  id: string;
  doctorId: string;
  startDate: string;
  endDate: string;
  reason: "licencia" | "vacaciones" | "pasantia" | "otro";
  note?: string;
}
export interface PointFreeze {
  id: string;
  doctorId: string;
  startDate: string;
  endDate: string;
}
export interface BaseCorrection {
  assignmentId: string;
  worked: boolean;
  reason: string;
}
export interface PointRecord {
  doctorId: string;
  date: string;
  points: number;
  expiresAt: string;
  source: "base" | "replacement";
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SANTIAGO, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function santiagoParts(value: string | number | Date) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(new Date(value))
    .map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

export function santiagoTime(date: string, hour: number) {
  const [year, month, day] = date.split("-").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour);
  let result = wanted;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = santiagoParts(result);
    const [y, m, d] = actual.date.split("-").map(Number);
    result += wanted - Date.UTC(y, m - 1, d, actual.hour, actual.minute);
  }
  return result;
}

export function nextDate(date: string) {
  return format(addDays(new Date(date + "T12:00:00"), 1), "yyyy-MM-dd");
}

export function weekStart(date: string) {
  return format(startOfWeek(new Date(date + "T12:00:00"), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function shiftEnd(assignment: Pick<ShiftAssignment, "date" | "kind">) {
  return santiagoTime(assignment.kind === "DAY" ? assignment.date : nextDate(assignment.date),
    assignment.kind === "DAY" ? 20 : 8);
}

export function restIssues(assignments: ShiftAssignment[]) {
  const byDoctor = new Map<string, ShiftAssignment[]>();
  for (const item of assignments) byDoctor.set(item.doctorId, [...(byDoctor.get(item.doctorId) ?? []), item]);
  const issues: Array<{ doctorId: string; previous: ShiftAssignment; current: ShiftAssignment }> = [];
  for (const [doctorId, items] of byDoctor) {
    const sorted = items.sort((a, b) =>
      shiftStart(a) - shiftStart(b) || shiftEnd(a) - shiftEnd(b));
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const own24 = previous.date === current.date && previous.kind === "DAY" &&
        current.kind === "NIGHT" && shiftEnd(previous) === shiftStart(current);
      const required = previous.kind === "NIGHT" ? 24 : 12;
      if (!own24 && shiftStart(current) - shiftEnd(previous) < required * HOUR) {
        issues.push({ doctorId, previous, current });
      }
    }
  }
  return issues;
}

export function shiftStart(assignment: Pick<ShiftAssignment, "date" | "kind">) {
  return santiagoTime(assignment.date, assignment.kind === "DAY" ? 8 : 20);
}

export function expiresAt(date: string) {
  return format(addDays(new Date(date + "T12:00:00"), 120), "yyyy-MM-dd");
}

export function frozenExpiry(
  earnedDate: string, originalExpiry: string, doctorId: string, freezes: PointFreeze[],
) {
  let expiry = originalExpiry;
  const merged: Array<{ startDate: string; endDate: string }> = [];
  for (const item of freezes.filter((item) => item.doctorId === doctorId && item.endDate > earnedDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const last = merged.at(-1);
    if (last && item.startDate <= nextDate(last.endDate)) {
      if (item.endDate > last.endDate) last.endDate = item.endDate;
    } else merged.push({ startDate: item.startDate, endDate: item.endDate });
  }
  for (const item of merged) {
    const start = [item.startDate, nextDate(earnedDate)].sort().at(-1)!;
    if (start > expiry) break;
    const days = differenceInCalendarDays(
      new Date(item.endDate + "T12:00:00"), new Date(start + "T12:00:00"),
    ) + 1;
    if (days > 0) expiry = format(addDays(new Date(expiry + "T12:00:00"), days), "yyyy-MM-dd");
  }
  return expiry;
}

export function basePointRecords({
  schedules, absences, corrections, freezes, at,
}: {
  schedules: ScheduleMonth[];
  absences: Array<Pick<DoctorAbsence, "doctorId" | "startDate" | "endDate">>;
  corrections: Array<Pick<BaseCorrection, "assignmentId" | "worked">>;
  freezes: PointFreeze[];
  at: string;
}): PointRecord[] {
  const now = Date.parse(at);
  const today = santiagoParts(at).date;
  const corrected = new Map(corrections.map((item) => [item.assignmentId, item.worked]));
  return schedules.filter((month) => month.status === "published")
    .flatMap((month) => month.assignments)
    .filter((item) => item.date >= NEW_SYSTEM_START && shiftEnd(item) <= now)
    .filter((item) => corrected.get(item.id) ?? !absences.some((absence) =>
      absence.doctorId === item.doctorId &&
      absence.startDate <= (item.kind === "NIGHT" ? nextDate(item.date) : item.date) &&
      item.date <= absence.endDate))
    .map((item) => ({
      doctorId: item.doctorId,
      date: item.kind === "NIGHT" ? nextDate(item.date) : item.date,
      points: 1,
      source: "base" as const,
      expiresAt: frozenExpiry(
        item.kind === "NIGHT" ? nextDate(item.date) : item.date,
        expiresAt(item.kind === "NIGHT" ? nextDate(item.date) : item.date),
        item.doctorId,
        freezes,
      ),
    }))
    .filter((item) => item.expiresAt >= today);
}

export function replacementPointRecords(replacements: Replacement[], freezes: PointFreeze[], at: string): PointRecord[] {
  const today = santiagoParts(at).date;
  return replacements.map((item) => ({
    doctorId: item.doctorId, date: item.date, points: item.points, source: "replacement" as const,
    expiresAt: item.date >= NEW_SYSTEM_START
      ? frozenExpiry(item.date, item.expiresAt, item.doctorId, freezes)
      : item.expiresAt,
  })).filter((item) => item.expiresAt >= today);
}

export function availableFichas(replacements: Replacement[], doctorId: string, date: string) {
  if (date < NEW_SYSTEM_START) return null;
  const monday = weekStart(date);
  const following = format(addDays(new Date(monday + "T12:00:00"), 7), "yyyy-MM-dd");
  const spent = replacements.filter((item) => item.doctorId === doctorId &&
    item.mode === "voluntary" && item.date >= monday && item.date < following &&
    item.date >= NEW_SYSTEM_START)
    .reduce((sum, item) => sum + (item.typeCode === "FULL_24" || item.typeCode === "SAT_HOLIDAY_24" ? 2 : 1), 0);
  return Math.max(0, 2 - spent);
}

export function canVolunteer(replacements: Replacement[], doctorId: string, date: string, hours: 12 | 24) {
  const fichas = availableFichas(replacements, doctorId, date);
  return fichas === null || fichas >= (hours === 24 ? 2 : 1);
}

export function appliesOnCall(date: string) {
  return date >= NEW_SYSTEM_START;
}

export function generateOnCallWeeks({
  monthId, doctors, schedules, absences, existing,
}: {
  monthId: string; doctors: Doctor[]; schedules: ScheduleMonth[];
  absences: DoctorAbsence[]; existing: OnCallWeek[];
}): OnCallWeek[] {
  if (monthId < NEW_SYSTEM_START.slice(0, 7)) return [];
  const [year, month] = monthId.split("-").map(Number);
  const last = format(new Date(year, month, 0, 12), "yyyy-MM-dd");
  const weeks = new Set<string>();
  for (let date = monthId + "-01"; date <= last; date = nextDate(date)) weeks.add(weekStart(date));
  const result = [...existing];
  for (const start of weeks) {
    if (result.some((item) => item.weekStart === start)) continue;
    const end = format(addDays(new Date(start + "T12:00:00"), 6), "yyyy-MM-dd");
    const eligible = doctors.filter((doctor) => doctor.active && !doctor.onlyVolunteer &&
      !absences.some((absence) => absence.doctorId === doctor.id &&
        absence.startDate <= end && absence.endDate >= (start < NEW_SYSTEM_START ? NEW_SYSTEM_START : start)))
      .sort((a, b) => {
        const count = (id: string) => result.filter((item) => item.weekStart < start && item.doctorIds.includes(id)).length;
        const shifts = (id: string) => schedules.filter((item) => item.status === "published")
          .flatMap((item) => item.assignments).filter((item) => item.doctorId === id &&
            item.date >= start && item.date <= end).length;
        return count(a.id) - count(b.id) || shifts(a.id) - shifts(b.id) || a.sortOrder - b.sortOrder;
      });
    if (eligible.length < 3) throw new Error("No hay tres médicos disponibles para la semana " + start);
    result.push({ weekStart: start, doctorIds: eligible.slice(0, 3).map((item) => item.id),
      manual: false, needsReview: false });
  }
  return result.filter((item) => weeks.has(item.weekStart));
}
