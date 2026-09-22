import { beforeEach, describe, expect, it, vi } from "vitest";

type CapturedQuery = {
  strings: string[];
  values: unknown[];
};

const mocks = vi.hoisted(() => ({
  queries: [] as CapturedQuery[],
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  hasJefaturaSession: vi.fn(async () => true),
}));

vi.mock("@/db", () => {
  const sql = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    }),
    {
      transaction: mocks.transaction,
    },
  );

  return {
    getSql: () => sql,
    isDatabaseConfigured: () => true,
    getDb: () => ({
      select: () => ({
        from: () => ({
          where: async () => [{ version: 7, status: "published" }],
        }),
      }),
    }),
  };
});

import { PATCH } from "@/app/api/schedules/[id]/route";

describe("schedule autosave publication state", () => {
  beforeEach(() => {
    mocks.queries = [];
    mocks.transaction.mockReset();
    mocks.transaction.mockImplementation(async (queries: CapturedQuery[]) => {
      mocks.queries = queries;
    });
  });

  it("keeps an already published month published during autosave", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/schedules/2026-09", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "2026-09",
          assignments: [
            { date: "2026-09-15", kind: "DAY", slot: 1, doctorId: "doctor-1" },
          ],
        }),
      }),
      { params: Promise.resolve({ id: "2026-09" }) },
    );

    expect(response.status).toBe(200);
    const monthUpsert = mocks.queries[0];
    expect(monthUpsert.strings.join("?")).toContain(
      "ELSE schedule_months.status END",
    );
    expect(monthUpsert.strings.join("?")).not.toContain(
      "ELSE 'draft'::schedule_status END",
    );
  });
});
