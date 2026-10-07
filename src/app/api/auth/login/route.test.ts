import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attempts: new Map<string, number>(),
  createSession: vi.fn(async () => undefined),
  verifyPassword: vi.fn((password: string) => password === "correcta"),
}));

vi.mock("@/lib/auth", () => ({
  createSession: mocks.createSession,
  identityHash: (identity: string) => identity,
  verifyPassword: mocks.verifyPassword,
}));

vi.mock("@/db", () => ({
  isDatabaseConfigured: () => true,
  getSql: () => async (_parts: TemplateStringsArray, identity: string) => {
    const count = (mocks.attempts.get(identity) ?? 0) + 1;
    mocks.attempts.set(identity, count);
    return [{ attempts: count }];
  },
}));

import { POST } from "@/app/api/auth/login/route";

function login(password: string) {
  return POST(new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.7" },
    body: JSON.stringify({ password }),
  }));
}

describe("login rate limit", () => {
  beforeEach(() => {
    mocks.attempts.clear();
    mocks.createSession.mockClear();
    mocks.verifyPassword.mockClear();
  });

  it("allows ten accesses and blocks the eleventh before password verification", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await login("correcta")).status).toBe(200);
    }
    expect((await login("correcta")).status).toBe(429);
    expect(mocks.createSession).toHaveBeenCalledTimes(10);
    expect(mocks.verifyPassword).toHaveBeenCalledTimes(10);
  });
});
