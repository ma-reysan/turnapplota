import { describe, expect, it } from "vitest";
import { buildPeriodAnalysis, monthRange } from "@/lib/analysis";
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
