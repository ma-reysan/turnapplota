import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorized: true, configured: true, query: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/db", () => ({
  isDatabaseConfigured: () => mocks.configured,
  getSql: () => Object.assign(mocks.query, { transaction: mocks.transaction }),
}));
vi.mock("@/lib/auth", () => ({ hasJefaturaSession: async () => mocks.authorized }));
import { GET, PUT } from "./route";

function request(theme: unknown) {
  return new Request("https://turnapp.test/api/appearance", {
    method: "PUT", headers: { "Content-Type": "application/json", origin: "https://turnapp.test" },
    body: JSON.stringify({ theme }),
  });
}
describe("global appearance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorized = true;
    mocks.configured = true;
    mocks.query.mockResolvedValue([]);
    mocks.transaction.mockResolvedValue([[], [{ id: "publication-1" }]]);
  });
  it("returns the seasonal default when nothing has been published, without writing", async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ theme: "auto", revision: "initial" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("returns only the published theme and its revision", async () => {
    mocks.query.mockResolvedValue([{ theme: "halloween", id: "publication-2" }]);
    expect(await (await GET()).json()).toEqual({ theme: "halloween", revision: "publication-2" });
  });
  it("requires Jefatura before writing", async () => {
    mocks.authorized = false;
    expect((await PUT(request("halloween"))).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects invalid themes", async () => {
    expect((await PUT(request("invalid"))).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("publishes an authenticated choice with a new global revision", async () => {
    expect(await (await PUT(request("halloween"))).json()).toEqual({ theme: "halloween", revision: "publication-1" });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });
  it("does not report success when the database fails", async () => {
    mocks.transaction.mockRejectedValue(new Error("offline"));
    expect((await PUT(request("blue"))).status).toBe(503);
  });
  it("rejects cross-origin publication", async () => {
    const input = request("blue");
    input.headers.set("origin", "https://other.test");
    expect((await PUT(input)).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
