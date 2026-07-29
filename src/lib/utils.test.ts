import { describe, expect, it } from "vitest";
import {
  calendarDays,
  isActiveReplacement,
  monthKey,
  normalizeDoctorSearch,
} from "@/lib/utils";

describe("calendar and replacement helpers", () => {
  it("starts calendar weeks on Monday", () => {
    expect(calendarDays(2026, 8)[0].getDay()).toBe(1);
  });

  it("normalizes accents and case for doctor suggestions", () => {
    expect(normalizeDoctorSearch("  Peñafiel ")).toBe("PENAFIEL");
  });

  it("keeps replacements active for 120 days", () => {
    expect(isActiveReplacement("2026-04-01", new Date("2026-07-29"))).toBe(true);
    expect(isActiveReplacement("2026-03-01", new Date("2026-07-29"))).toBe(false);
  });

  it("formats month keys", () => {
    expect(monthKey(2026, 8)).toBe("2026-08");
  });
});
