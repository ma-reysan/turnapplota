import { describe, expect, it } from "vitest";
import {
  availableFichas, basePointRecords, canVolunteer, frozenExpiry,
  manualOnCallWeek, prepareOnCallWeeks, restIssues, santiagoParts, santiagoTime, shiftEnd,
  shiftStart,
} from "@/lib/november-system";
import type { Replacement, ScheduleMonth, ShiftAssignment } from "@/lib/types";

const assignment = (id: string, date: string, kind: "DAY" | "NIGHT", doctorId = "a"): ShiftAssignment =>
  ({ id, date, kind, slot: 1, doctorId });
const month = (id: string, assignments: ShiftAssignment[]): ScheduleMonth => ({
  id, year: Number(id.slice(0, 4)), month: Number(id.slice(5)), status: "published", assignments,
});
const replacement = (id: string, date: string, mode: "voluntary" | "invoked", typeCode = "DAY_MON"): Replacement =>
  ({ id, date, doctorId: "a", typeCode, points: 2, mode, superhero: false, expiresAt: "2027-03-01" });

describe("cambio del 1 de noviembre", () => {
  it("usa la hora de Chile y excluye el turno nocturno iniciado el 31 de octubre", () => {
    const schedules = [
      month("2026-10", [assignment("old-night", "2026-10-31", "NIGHT")]),
      month("2026-11", [
        assignment("day", "2026-11-01", "DAY"),
        assignment("night", "2026-11-01", "NIGHT"),
      ]),
    ];
    const input = { schedules, absences: [], corrections: [], freezes: [] };
    expect(santiagoParts(santiagoTime("2026-11-01", 8)).date).toBe("2026-11-01");
    expect(basePointRecords({ ...input, at: new Date(santiagoTime("2026-11-01", 19)).toISOString() })).toEqual([]);
    expect(basePointRecords({ ...input, at: new Date(santiagoTime("2026-11-01", 20)).toISOString() })
      .map((item) => item.points)).toEqual([1]);
    expect(basePointRecords({ ...input, at: new Date(shiftEnd(assignment("night", "2026-11-01", "NIGHT"))).toISOString() }))
      .toHaveLength(2);
  });

  it("respeta el cambio de hora de Chile al cerrar un turno nocturno", () => {
    const night = assignment("dst", "2027-04-03", "NIGHT");
    expect(santiagoParts(shiftStart(night))).toMatchObject({ date: "2027-04-03", hour: 20 });
    expect(santiagoParts(shiftEnd(night))).toMatchObject({ date: "2027-04-04", hour: 8 });
    expect(shiftEnd(night) - shiftStart(night)).toBe(13 * 60 * 60 * 1000);
  });

  it("cuenta dos bloques de un 24 horas, respeta ausencia nocturna y corrección", () => {
    const schedules = [month("2026-11", [
      assignment("day", "2026-11-01", "DAY"), assignment("night", "2026-11-01", "NIGHT"),
    ])];
    const at = "2026-11-02T12:00:00.000Z";
    expect(basePointRecords({ schedules, absences: [], corrections: [], freezes: [], at })).toHaveLength(2);
    expect(basePointRecords({ schedules, absences: [], corrections: [], freezes: [], at })
      .map((item) => item.date)).toEqual(["2026-11-01", "2026-11-02"]);
    const absences = [{ doctorId: "a", startDate: "2026-11-02", endDate: "2026-11-02" }];
    expect(basePointRecords({ schedules, absences, corrections: [], freezes: [], at })).toHaveLength(1);
    expect(basePointRecords({ schedules, absences, corrections: [
      { assignmentId: "night", worked: true },
    ], freezes: [], at })).toHaveLength(2);
  });

  it("identifica cada punto base y permite excluirlo sin alterar otros turnos", () => {
    const schedules = [month("2026-11", [
      assignment("day", "2026-11-01", "DAY"),
      assignment("night", "2026-11-01", "NIGHT"),
    ])];
    const input = { schedules, absences: [], freezes: [], at: "2026-11-02T12:00:00.000Z" };
    expect(basePointRecords({ ...input, corrections: [], includeExpired: true })
      .map((item) => item.assignmentId)).toEqual(["day", "night"]);
    expect(basePointRecords({ ...input, corrections: [{ assignmentId: "day", worked: false }], includeExpired: true })
      .map((item) => item.assignmentId)).toEqual(["night"]);
  });

  it("reserva fichas solo al voluntariado desde noviembre", () => {
    const records = [
      replacement("old", "2026-10-31", "voluntary"),
      replacement("invoked", "2026-11-01", "invoked"),
      replacement("own", "2026-11-01", "voluntary"),
    ];
    expect(availableFichas(records, "a", "2026-10-31")).toBeNull();
    expect(availableFichas(records, "a", "2026-11-01")).toBe(1);
    expect(canVolunteer(records, "a", "2026-11-01", 24)).toBe(false);
    expect(availableFichas(records, "a", "2026-11-02")).toBe(2);
    expect(availableFichas([...records, replacement("base", "2026-11-01", "voluntary", "BASE")],
      "a", "2026-11-01")).toBe(1);
  });

  it("aplica descanso entre meses y deja día más noche del mismo día como 24 horas", () => {
    const oldNight = assignment("old-night", "2026-10-31", "NIGHT");
    const nextDay = assignment("next-day", "2026-11-01", "DAY");
    expect(restIssues([oldNight, nextDay])).toHaveLength(1);
    expect(restIssues([
      assignment("day", "2026-11-01", "DAY"),
      assignment("night", "2026-11-01", "NIGHT"),
    ])).toEqual([]);
  });

  it("prepara tres cupos vacíos por semana sin asignar médicos automáticamente", () => {
    const weeks = prepareOnCallWeeks("2026-11", []);
    expect(weeks.find((item) => item.weekStart === "2026-10-26")).toMatchObject({
      doctorIds: ["", "", ""], colorKeys: [null, null, null], manual: false,
    });
    expect(prepareOnCallWeeks("2026-10", [])).toEqual([]);
  });

  it("conserva una selección manual parcial y sus colores", () => {
    const stored = { weekStart: "2026-11-02", doctorIds: ["a", "", ""],
      colorKeys: ["sky" as const, null, null], manual: true, needsReview: false };
    expect(prepareOnCallWeeks("2026-11", [stored]).find((item) => item.weekStart === stored.weekStart))
      .toEqual(stored);
  });

  it("no presenta como manual una selección creada por el algoritmo anterior", () => {
    const old = { weekStart: "2026-11-02", doctorIds: ["a", "b", "c"],
      colorKeys: [null, null, null], manual: false, needsReview: false };
    expect(manualOnCallWeek(old).doctorIds).toEqual(["", "", ""]);
    expect(old.doctorIds).toEqual(["a", "b", "c"]);
  });

  it("pausa vencimientos sin duplicar intervalos superpuestos", () => {
    expect(frozenExpiry("2026-11-01", "2027-03-01", "a", [
      { id: "one", doctorId: "a", startDate: "2027-02-20", endDate: "2027-03-05" },
      { id: "two", doctorId: "a", startDate: "2027-03-01", endDate: "2027-03-10" },
    ])).toBe("2027-03-20");
  });
});
