import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "turnapp_jefatura";

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  }
  return new TextEncoder().encode(secret);
}

export function verifyPassword(password: string) {
  const stored = process.env.JEFE_PASSWORD_HASH;
  if (!stored) return false;
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export async function createSession() {
  const token = await new SignJWT({ role: "jefatura" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(sessionKey());
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function hasJefaturaSession() {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return false;
    const result = await jwtVerify(token, sessionKey());
    return result.payload.role === "jefatura";
  } catch {
    return false;
  }
}

export function identityHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
