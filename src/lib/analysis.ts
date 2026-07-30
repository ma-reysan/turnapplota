import { addDays, endOfMonth, startOfMonth } from "date-fns";
import type { Doctor, Holiday, ScheduleMonth, Vacation } from "@/lib/types";

export type ShiftCategory = "total" | "day" | "night" | "daySpecial" | "nightSpecial";

export interface DoctorAnalysis {
  doctor: Doctor;
  vacationDays: number;
  availableDays: number;
  total: number;
  day: number;
  night: number;
  daySpecial: number;
  nightSpecial: number;
  expected: Record<ShiftCategory, number>;
  difference: number;
  longestStreak: number;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function daysInRange(start: Date, end: Date) {
  const days: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) days.push(dateKey(cursor));
  return days;
}

function isSpecialDay(date: string, holidayDates: Set<string>) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return weekday === 0 || weekday === 6 || holidayDates.has(date);
}

function countStreak(dates: string[]) {
  const unique = [...new Set(dates)].sort();
  let longest = 0;
  let current = 0;
  let previous = "";
  for (const date of unique) {
    current = previous && date === dateKey(addDays(new Date(`${previous}T12:00:00`), 1)) ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}

export function buildPeriodAnalysis({
  doctors,
  schedules,
  vacations,
  holidays,
  start,
  end,
}: {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  vacations: Vacation[];
  holidays: Holiday[];
  start: Date;
  end: Date;
}) {
  const dates = daysInRange(start, end);
  const inPeriod = new Set(dates);
  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const activeDoctors = doctors.filter((doctor) => doctor.active);
  const assignments = schedules.flatMap((schedule) => schedule.assignments).filter((item) => inPeriod.has(item.date));
  const vacationDatesByDoctor = new Map<string, Set<string>>();

  for (const vacation of vacations) {
    const rangeStart = new Date(`${vacation.startDate}T12:00:00`) > start ? new Date(`${vacation.startDate}T12:00:00`) : start;
    const rangeEnd = new Date(`${vacation.endDate}T12:00:00`) < end ? new Date(`${vacation.endDate}T12:00:00`) : end;
    if (rangeStart > rangeEnd) continue;
    const set = vacationDatesByDoctor.get(vacation.doctorId) ?? new Set<string>();
    daysInRange(rangeStart, rangeEnd).forEach((date) => set.add(date));
    vacationDatesByDoctor.set(vacation.doctorId, set);
  }

  const categoryDates: Record<ShiftCategory, string[]> = {
    total: dates,
    day: dates.filter((date) => !isSpecialDay(date, holidayDates)),
    night: dates.filter((date) => !isSpecialDay(date, holidayDates)),
    daySpecial: dates.filter((date) => isSpecialDay(date, holidayDates)),
    nightSpecial: dates.filter((date) => isSpecialDay(date, holidayDates)),
  };
  const categoryTotals: Record<ShiftCategory, number> = {
    total: assignments.length,
    day: assignments.filter((item) => item.kind === "DAY" && !isSpecialDay(item.date, holidayDates)).length,
    night: assignments.filter((item) => item.kind === "NIGHT" && !isSpecialDay(item.date, holidayDates)).length,
    daySpecial: assignments.filter((item) => item.kind === "DAY" && isSpecialDay(item.date, holidayDates)).length,
    nightSpecial: assignments.filter((item) => item.kind === "NIGHT" && isSpecialDay(item.date, holidayDates)).length,
  };
  const availability = new Map<string, Record<ShiftCategory, number>>();
  for (const doctor of activeDoctors) {
    const absent = vacationDatesByDoctor.get(doctor.id) ?? new Set<string>();
    availability.set(doctor.id, {
      total: categoryDates.total.filter((date) => !absent.has(date)).length,
      day: categoryDates.day.filter((date) => !absent.has(date)).length,
      night: categoryDates.night.filter((date) => !absent.has(date)).length,
      daySpecial: categoryDates.daySpecial.filter((date) => !absent.has(date)).length,
      nightSpecial: categoryDates.nightSpecial.filter((date) => !absent.has(date)).length,
    });
  }
  const availabilityTotals = (Object.keys(categoryTotals) as ShiftCategory[]).reduce(
    (result, category) => ({
      ...result,
      [category]: [...availability.values()].reduce((sum, item) => sum + item[category], 0),
    }),
    {} as Record<ShiftCategory, number>,
  );

  const metrics: DoctorAnalysis[] = activeDoctors.map((doctor) => {
    const doctorAssignments = assignments.filter((item) => item.doctorId === doctor.id);
    const absent = vacationDatesByDoctor.get(doctor.id) ?? new Set<string>();
    const available = availability.get(doctor.id)!;
    const total = doctorAssignments.length;
    const expected = (Object.keys(categoryTotals) as ShiftCategory[]).reduce(
      (result, category) => ({
        ...result,
        [category]: availabilityTotals[category]
          ? (categoryTotals[category] * available[category]) / availabilityTotals[category]
          : 0,
      }),
      {} as Record<ShiftCategory, number>,
    );
    return {
      doctor,
      vacationDays: absent.size,
      availableDays: available.total,
      total,
      day: doctorAssignments.filter((item) => item.kind === "DAY" && !isSpecialDay(item.date, holidayDates)).length,
      night: doctorAssignments.filter((item) => item.kind === "NIGHT" && !isSpecialDay(item.date, holidayDates)).length,
      daySpecial: doctorAssignments.filter((item) => item.kind === "DAY" && isSpecialDay(item.date, holidayDates)).length,
      nightSpecial: doctorAssignments.filter((item) => item.kind === "NIGHT" && isSpecialDay(item.date, holidayDates)).length,
      expected,
      difference: total - expected.total,
      longestStreak: countStreak(doctorAssignments.map((item) => item.date)),
    };
  });

  const coveredSlots = new Set(assignments.map((item) => `${item.date}-${item.kind}-${item.slot}`));
  const missingSlots = dates.reduce((sum, date) => sum + ["DAY-1", "DAY-2", "DAY-3", "NIGHT-1", "NIGHT-2"].filter((slot) => !coveredSlots.has(`${date}-${slot}`)).length, 0);
  return { metrics, assignments, dates, holidayDates, missingSlots };
}

export function monthRange(year: number, month: number) {
  const reference = new Date(year, month - 1, 1, 12);
  return { start: startOfMonth(reference), end: endOfMonth(reference) };
}
