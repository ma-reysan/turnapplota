import { describe, expect, it } from "vitest";
import { replacementInputSchema, schedulePatchSchema, scheduleUpdateSchema } from "@/lib/validation";

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

describe("schedule color validation", () => {
  const schedule = {
    id: "2026-07",
    version: 1,
    publish: false,
    assignments: [],
  };

  it("allows a color on an empty shift card", () => {
    const parsed = scheduleUpdateSchema.parse({
      ...schedule,
      markers: [
        {
          id: "2026-07-2026-07-10-day-1-color",
          date: "2026-07-10",
          kind: "DAY",
          slot: 1,
          colorKey: "teal",
        },
      ],
    });
    expect(parsed.markers[0]?.colorKey).toBe("teal");
  });

  it("rejects colors outside the configured palette", () => {
    expect(() =>
      scheduleUpdateSchema.parse({
        ...schedule,
        markers: [
          {
            id: "invalid-color",
            date: "2026-07-10",
            kind: "DAY",
            slot: 1,
            colorKey: "white",
          },
        ],
      }),
    ).toThrow();
  });
});


describe("schedule autosave validation", () => {
  it("accepts a partial card update and an explicit empty card", () => {
    const parsed = schedulePatchSchema.parse({
      id: "2026-07",
      assignments: [
        { date: "2026-07-10", kind: "DAY", slot: 1, doctorId: "jreyes" },
        { date: "2026-07-10", kind: "NIGHT", slot: 2, doctorId: null },
      ],
    });
    expect(parsed.assignments[1]?.doctorId).toBeNull();
  });
});
