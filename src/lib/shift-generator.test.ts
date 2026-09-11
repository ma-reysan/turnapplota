import { describe, expect, it } from "vitest";
import {
  analyzeGeneratorSchedule,
  createDefaultGeneratorSettings,
  createGeneratorDraft,
  generateShiftSchedule,
  generatorMonthDates,
  generatorParticipants,
  isGeneratorWeekend,
} from "@/lib/shift-generator";

function settings() {
  const value = createDefaultGeneratorSettings();
  return {
    ...value,
    lanes: value.lanes.map((lane) => ({
      ...lane,
      members: lane.members.map((member) => ({ ...member, name: member.id })),
    })),
    wildcard: { ...value.wildcard, name: "Comodín" },
  };
}

function generate(id = "2026-09") {
  return generateShiftSchedule({
    draft: createGeneratorDraft(id),
    settings: settings(),
    holidays: [],
  });
}

describe("shift generator", () => {
  it.each([
    ["2025-02", 28],
    ["2024-02", 29],
    ["2026-04", 30],
    ["2026-05", 31],
  ])("creates five slots for every day in %s", (id, days) => {
    const result = generate(id);
    expect(generatorMonthDates(result.year, result.month)).toHaveLength(days);
    expect(result.assignments).toHaveLength(days * 5);
    expect(result.assignments.every((assignment) => assignment.participantId)).toBe(true);
  });

  it("is deterministic for equal inputs", () => {
    expect(generate("2026-10").assignments).toEqual(generate("2026-10").assignments);
  });

  it("uses each balanced trio for the diurnal rotation", () => {
    const config = settings();
    const result = generateShiftSchedule({
      draft: createGeneratorDraft("2026-09", 2),
      settings: config,
      holidays: [],
    });
    const firstDay = result.assignments
      .filter((assignment) => assignment.date === "2026-09-01" && assignment.kind === "DAY")
      .map((assignment) => assignment.participantId);
    expect(firstDay).toEqual(config.lanes[2].members.map((member) => member.id));
  });

  it("respects absences and replaces a missing diurnal member from the same speed", () => {
    const config = settings();
    const missing = config.lanes[0].members[0];
    const draft = {
      ...createGeneratorDraft("2026-09"),
      absences: [{
        id: "absence-1",
        participantId: missing.id,
        startDate: "2026-09-01",
        endDate: "2026-09-01",
        kind: "BOTH" as const,
      }],
    };
    const result = generateShiftSchedule({ draft, settings: config, holidays: [] });
    expect(result.assignments.some(
      (assignment) => assignment.date === "2026-09-01" && assignment.participantId === missing.id,
    )).toBe(false);
    const replacement = result.assignments.find(
      (assignment) => assignment.date === "2026-09-01" && assignment.kind === "DAY" && assignment.slot === 1,
    );
    expect(generatorParticipants(config).find(
      (participant) => participant.id === replacement?.participantId,
    )?.speed).toBe("fast");
  });

  it("keeps the wildcard inside its contract and monthly caps", () => {
    const config = settings();
    const result = generate("2026-09");
    const wildcard = result.assignments.filter(
      (assignment) => assignment.participantId === config.wildcard.id,
    );
    expect(wildcard).toHaveLength(5);
    expect(wildcard.length).toBeLessThanOrEqual(6);
    for (const assignment of wildcard) {
      const weekday = new Date(`${assignment.date}T12:00:00`).getDay();
      expect(
        (weekday === 5 && assignment.kind === "NIGHT")
          || (weekday === 6 && (assignment.kind === "DAY" || assignment.kind === "NIGHT"))
          || (weekday === 0 && assignment.kind === "DAY"),
      ).toBe(true);
    }
    const byWeekend = new Map<string, number>();
    for (const assignment of wildcard) {
      const value = new Date(`${assignment.date}T12:00:00`);
      const weekday = value.getDay();
      value.setDate(value.getDate() + (weekday === 0 ? -2 : 5 - weekday));
      const key = value.toISOString().slice(0, 10);
      byWeekend.set(key, (byWeekend.get(key) ?? 0) + 1);
    }
    expect(Math.max(...byWeekend.values())).toBeLessThanOrEqual(2);
  });

  it("never assigns a day immediately after the same doctor's night", () => {
    const result = generate("2026-09");
    const nightKeys = new Set(
      result.assignments
        .filter((assignment) => assignment.kind === "NIGHT" && assignment.participantId)
        .map((assignment) => {
          const date = new Date(`${assignment.date}T12:00:00`);
          date.setDate(date.getDate() + 1);
          return `${assignment.participantId}:${date.toISOString().slice(0, 10)}`;
        }),
    );
    expect(result.assignments.some(
      (assignment) =>
        assignment.kind === "DAY"
        && assignment.participantId
        && nightKeys.has(`${assignment.participantId}:${assignment.date}`),
    )).toBe(false);
  });

  it("treats Friday night, weekends, and holidays as FDS", () => {
    const holidayDates = new Set(["2026-09-17"]);
    expect(isGeneratorWeekend("2026-09-18", "NIGHT", holidayDates)).toBe(true);
    expect(isGeneratorWeekend("2026-09-18", "DAY", holidayDates)).toBe(false);
    expect(isGeneratorWeekend("2026-09-19", "DAY", holidayDates)).toBe(true);
    expect(isGeneratorWeekend("2026-09-17", "DAY", holidayDates)).toBe(true);
  });

  it("reports manual conflicts without blocking edits", () => {
    const config = settings();
    const result = generate("2026-09");
    const night = result.assignments.find(
      (assignment) => assignment.date === "2026-09-01" && assignment.kind === "NIGHT",
    )!;
    const conflicted = {
      ...result,
      assignments: result.assignments.map((assignment) =>
        assignment.date === "2026-09-02" && assignment.kind === "DAY" && assignment.slot === 1
          ? { ...assignment, participantId: night.participantId, source: "manual" as const }
          : assignment,
      ),
    };
    const analysis = analyzeGeneratorSchedule({ draft: conflicted, settings: config, holidays: [] });
    expect(analysis.warnings.some((warning) => warning.code === "POST_SHIFT")).toBe(true);
  });

  it("uses prior balances to lower the priority of an overloaded doctor", () => {
    const config = settings();
    const [overloaded, underloaded] = generatorParticipants(config);
    const draft = {
      ...createGeneratorDraft("2026-09"),
      balances: [
        { participantId: overloaded.id, total: 10, night: 10, weekend: 10 },
        { participantId: underloaded.id, total: -10, night: -10, weekend: -10 },
      ],
    };
    const result = generateShiftSchedule({ draft, settings: config, holidays: [] });
    const overloadedNights = result.assignments.filter(
      (assignment) => assignment.kind === "NIGHT" && assignment.participantId === overloaded.id,
    ).length;
    const underloadedNights = result.assignments.filter(
      (assignment) => assignment.kind === "NIGHT" && assignment.participantId === underloaded.id,
    ).length;
    expect(underloadedNights).toBeGreaterThan(overloadedNights);
  });

  it("prorates load when a doctor has a long programmed absence", () => {
    const config = settings();
    const absent = generatorParticipants(config)[0];
    const draft = {
      ...createGeneratorDraft("2026-09"),
      absences: [{
        id: "long-absence",
        participantId: absent.id,
        startDate: "2026-09-01",
        endDate: "2026-09-15",
        kind: "BOTH" as const,
      }],
    };
    const result = generateShiftSchedule({ draft, settings: config, holidays: [] });
    const analysis = analyzeGeneratorSchedule({ draft: result, settings: config, holidays: [] });
    const own = analysis.metrics.find((metric) => metric.participantId === absent.id)!;
    const regularTotals = analysis.metrics
      .filter((metric) => metric.participantId !== config.wildcard.id)
      .map((metric) => metric.total);
    expect(own.total).toBeLessThan(Math.max(...regularTotals));
    expect(Math.abs(own.projectedTotal)).toBeLessThanOrEqual(2);
  });

  it("leaves only mathematically impossible slots pending", () => {
    const config = settings();
    const regular = generatorParticipants(config);
    const draft = {
      ...createGeneratorDraft("2026-09"),
      absences: regular.slice(1).map((participant) => ({
        id: `absence-${participant.id}`,
        participantId: participant.id,
        startDate: "2026-09-01",
        endDate: "2026-09-01",
        kind: "BOTH" as const,
      })),
    };
    const result = generateShiftSchedule({ draft, settings: config, holidays: [] });
    const analysis = analyzeGeneratorSchedule({ draft: result, settings: config, holidays: [] });
    expect(analysis.warnings.some((warning) => warning.code === "EMPTY_SLOT")).toBe(true);
    expect(analysis.warnings.some((warning) => warning.code === "ABSENCE_CONFLICT")).toBe(false);
  });

});
