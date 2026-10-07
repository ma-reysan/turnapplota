import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  put: vi.fn(async () => ({ url: "https://blob.example/new", pathname: "agenda-aps/new", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })),
  del: vi.fn(async () => undefined),
  transaction: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ put: mocks.put, del: mocks.del, get: vi.fn() }));
vi.mock("@/db", () => ({
  isDatabaseConfigured: () => true,
  getSql: () => Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values }),
    { transaction: mocks.transaction },
  ),
  getDb: vi.fn(),
}));

import { POST } from "@/app/api/agenda-aps/route";

function uploadRequest() {
  const form = new FormData();
  form.set("updatedBy", "Médico de prueba");
  form.set("file", new File(["test"], "agenda.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  return { formData: async () => form } as Request;
}

describe("Agenda APS replacement", () => {
  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    mocks.put.mockClear();
    mocks.del.mockClear();
    mocks.transaction.mockReset();
  });
  afterEach(() => { delete process.env.BLOB_READ_WRITE_TOKEN; });

  it("archives the old agenda and writes the new agenda and audit in one transaction", async () => {
    mocks.transaction.mockResolvedValue([[], [{ blob_url: "https://blob.example/old" }], [], []]);
    const response = await POST(uploadRequest());
    expect(response.status).toBe(200);
    const queries = mocks.transaction.mock.calls[0][0] as { text: string }[];
    expect(queries.map((query) => query.text)).toEqual([
      expect.stringContaining("pg_advisory_xact_lock"),
      expect.stringContaining("UPDATE aps_agendas"),
      expect.stringContaining("INSERT INTO aps_agendas"),
      expect.stringContaining("INSERT INTO audit_events"),
    ]);
    expect(mocks.del).toHaveBeenCalledWith("https://blob.example/old");
  });

  it("removes only the newly uploaded file when the database transaction fails", async () => {
    mocks.transaction.mockRejectedValue(new Error("DB failure"));
    await expect(POST(uploadRequest())).rejects.toThrow("DB failure");
    expect(mocks.del).toHaveBeenCalledExactlyOnceWith("https://blob.example/new");
  });
});
