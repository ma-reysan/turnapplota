import { describe, expect, it } from "vitest";
import { isAccentTheme, isDieciochoSeason, isThemeChoice, resolveAccentTheme } from "@/lib/accent-theme";

describe("isDieciochoSeason", () => {
  it("activa la semana de septiembre que contiene el 18 y el 19", () => {
    expect(isDieciochoSeason(new Date("2026-09-14T12:00:00-03:00"))).toBe(true);
    expect(isDieciochoSeason(new Date("2026-09-20T12:00:00-03:00"))).toBe(true);
    expect(isDieciochoSeason(new Date("2026-09-13T12:00:00-03:00"))).toBe(false);
    expect(isDieciochoSeason(new Date("2026-09-21T12:00:00-03:00"))).toBe(false);
  });

  it("cubre dos semanas si el 18 y el 19 caen domingo y lunes", () => {
    expect(isDieciochoSeason(new Date("2022-09-12T12:00:00-03:00"))).toBe(true);
    expect(isDieciochoSeason(new Date("2022-09-25T12:00:00-03:00"))).toBe(true);
    expect(isDieciochoSeason(new Date("2022-09-11T12:00:00-03:00"))).toBe(false);
    expect(isDieciochoSeason(new Date("2022-09-26T12:00:00-03:00"))).toBe(false);
  });
});

describe("Christmas theme", () => {
  it("accepts Christmas for browser previews and publication", () => {
    expect(isAccentTheme("christmas")).toBe(true);
    expect(isThemeChoice("christmas")).toBe(true);
    expect(resolveAccentTheme("christmas", new Date("2026-09-18T12:00:00-03:00"))).toBe("christmas");
  });
  it("keeps automatic seasonal behavior unless Christmas is explicitly selected", () => {
    expect(resolveAccentTheme("auto", new Date("2026-12-25T12:00:00-03:00"))).toBe("green");
  });
});
