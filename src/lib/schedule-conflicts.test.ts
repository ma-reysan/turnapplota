import { describe, expect, it } from "vitest";
import { findNightToDayConflicts, incompatibleAssignmentIds } from "@/lib/schedule-conflicts";
import type { ShiftAssignment } from "@/lib/types";

const assignment = (id: string, date: string, kind: "DAY" | "NIGHT", doctorId = "reyes"): ShiftAssignment => ({ id, date, kind, slot: 1, doctorId });

describe("night-to-day schedule conflicts", () => {
  it("finds a night followed by a day for the same doctor, including across months", () => {
    const assignments = [
      assignment("night", "2026-08-31", "NIGHT"),
      assignment("day", "2026-09-01", "DAY"),
      assignment("other", "2026-09-01", "DAY", "saravia"),
    ];
    const conflicts = findNightToDayConflicts(assignments);
    expect(conflicts).toEqual([{ doctorId: "reyes", nightDate: "2026-08-31", dayDate: "2026-09-01" }]);
    expect(incompatibleAssignmentIds(assignments, conflicts)).toEqual(new Set(["night", "day"]));
  });

  it("does not flag a night without a next-day day shift", () => {
    expect(findNightToDayConflicts([
      assignment("night", "2026-08-20", "NIGHT"),
      assignment("same-day", "2026-08-20", "DAY"),
      assignment("next-day-other-doctor", "2026-08-21", "DAY", "saravia"),
    ])).toEqual([]);
  });
});
