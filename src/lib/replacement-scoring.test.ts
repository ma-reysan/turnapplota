import { describe, expect, it } from "vitest";
import { REPLACEMENT_TYPES } from "@/lib/constants";
import { getAutomaticReplacementType } from "@/lib/replacement-scoring";

const holidays = new Set(["2026-09-18"]);

function score(date: string, shift: "day" | "night" | "both") {
  return getAutomaticReplacementType({ date, shift, types: REPLACEMENT_TYPES, holidays });
}

describe("getAutomaticReplacementType", () => {
  it.each([
    ["2026-09-07", "day", "DAY_MON", 3],
    ["2026-09-08", "night", "NIGHT_MON_THU", 2],
    ["2026-09-11", "day", "DAY_FRI", 3],
    ["2026-09-11", "night", "NIGHT_FRI", 3],
    ["2026-09-12", "day", "SAT_12", 3],
    ["2026-09-13", "day", "SUN_DAY", 3],
    ["2026-09-13", "night", "SUN_NIGHT", 2],
  ] as const)("maps %s %s to %s", (date, shift, code, points) => {
    expect(score(date, shift)).toMatchObject({ code, defaultPoints: points });
  });

  it("combines both shifts into a 24-hour score", () => {
    expect(score("2026-09-07", "both")).toMatchObject({
      code: "FULL_24",
      defaultPoints: 5,
    });
  });

  it("uses the special 24-hour rule on Saturdays and holidays", () => {
    expect(score("2026-09-12", "both")).toMatchObject({
      code: "SAT_HOLIDAY_24",
      defaultPoints: 7,
    });
    expect(score("2026-09-18", "both")).toMatchObject({
      code: "SAT_HOLIDAY_24",
      defaultPoints: 7,
    });
  });
});
