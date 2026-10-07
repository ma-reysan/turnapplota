import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  latest: null as null | Record<string, unknown>,
}));

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/db", () => ({
  isDatabaseConfigured: () => true,
  getDb: () => ({
    select: () => ({ from: () => ({ orderBy: () => ({ limit: async () => mocks.latest ? [mocks.latest] : [] }) }) }),
  }),
}));

import { syncLunchMenu } from "@/lib/lunch-menu";

describe("daily lunch menu synchronization", () => {
  it("does not fetch again today even if the source still shows yesterday's menu", async () => {
    const dateFormat = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
    });
    const yesterday = dateFormat.format(new Date(Date.now() - 24 * 60 * 60 * 1000));
    mocks.latest = {
      id: "menu-1", menuDate: yesterday, content: "Almuerzo", sourceUrl: "https://example.com",
      fetchedAt: new Date(),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const menu = await syncLunchMenu();
      expect(menu.menuDate).toBe(yesterday);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      mocks.latest = null;
    }
  });
});
