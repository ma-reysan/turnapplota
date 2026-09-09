import { describe, expect, it } from "vitest";
import { buildPeriodAnalysis, buildScheduleManagerAnalysis, monthRange } from "@/lib/analysis";
import type { Doctor, ScheduleMonth } from "@/lib/types";

const doctors: Doctor[] = [
  { id: "a", shortName: "A", longName: "A", active: true, sortOrder: 0 },
  { id: "b", shortName: "B", longName: "B", active: true, sortOrder: 1 },
];
const schedules: ScheduleMonth[] = [{ id: "2026-01", year: 2026, month: 1, status: "published", assignments: [
  { id: "1", date: "2026-01-05", kind: "DAY", slot: 1, doctorId: "a" },
  { id: "2", date: "2026-01-05", kind: "DAY", slot: 2, doctorId: "b" },
] }];

describe("period analysis", () => {
  it("counts completed shifts and shares the same expectation across active doctors", () => {
    const result = buildPeriodAnalysis({ doctors, schedules, holidays: [], ...monthRange(2026, 1) });
    const a = result.metrics.find((item) => item.doctor.id === "a")!;
    const b = result.metrics.find((item) => item.doctor.id === "b")!;
    expect(a.total).toBe(1);
    expect(a.expected.total).toBeCloseTo(b.expected.total);
  });

  it("classifies marked holidays as special days", () => {
    const result = buildPeriodAnalysis({ doctors, schedules, holidays: [{ date: "2026-01-05", label: "Feriado" }], ...monthRange(2026, 1) });
    expect(result.metrics.find((item) => item.doctor.id === "a")?.daySpecial).toBe(1);
  });
});


describe("schedule manager analysis", () => {
  it("counts Friday nights as weekend shifts and compares the current month with the team average", () => {
    const result = buildScheduleManagerAnalysis({
      doctors,
      year: 2026,
      month: 1,
      schedules: [{
        id: "2026-01",
        year: 2026,
        month: 1,
        status: "draft",
        assignments: [
          { id: "fri-night", date: "2026-01-02", kind: "NIGHT", slot: 1, doctorId: "a" },
          { id: "sat-day", date: "2026-01-03", kind: "DAY", slot: 1, doctorId: "a" },
          { id: "weekday", date: "2026-01-05", kind: "DAY", slot: 1, doctorId: "b" },
        ],
      }],
    });
    const a = result.rows.find((item) => item.doctor.id === "a")!;
    expect(a.month).toBe(2);
    expect(a.weekend).toBe(2);
    expect(a.difference).toBeCloseTo(0.5);
  });
});
