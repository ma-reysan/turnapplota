import { describe, expect, it } from "vitest";
import { replacementInputSchema } from "@/lib/validation";

const replacement = {
  id: "replacement-test",
  date: "2026-07-29",
  doctorId: "jreyes",
  typeCode: "DAY_MON",
  points: 3,
  mode: "voluntary" as const,
};

describe("replacement validation", () => {
  it("keeps older clients compatible by defaulting superhero to false", () => {
    expect(replacementInputSchema.parse(replacement).superhero).toBe(false);
  });

  it("preserves the superhero marker", () => {
    expect(
      replacementInputSchema.parse({ ...replacement, points: 4, superhero: true }).superhero,
    ).toBe(true);
  });
});
