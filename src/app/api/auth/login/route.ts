import { createSession, identityHash, verifyPassword } from "@/lib/auth";
import { getSql, isDatabaseConfigured } from "@/db";

const MAX_ATTEMPTS = 10;

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ error: "Inicio de sesión no disponible" }, { status: 503 });
  const identity = identityHash(
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local",
  );
  const sql = getSql();
  const limitRows = await sql`
    INSERT INTO auth_rate_limits (identity_hash, window_start, attempts)
    VALUES (${identity}, now(), 1)
    ON CONFLICT (identity_hash) DO UPDATE SET
      attempts = CASE
        WHEN auth_rate_limits.window_start <= now() - interval '15 minutes' THEN 1
        ELSE auth_rate_limits.attempts + 1
      END,
      window_start = CASE
        WHEN auth_rate_limits.window_start <= now() - interval '15 minutes' THEN now()
        ELSE auth_rate_limits.window_start
      END
    RETURNING attempts
  ` as Record<string, unknown>[];
  const [limit] = limitRows;
  if (Number(limit.attempts) > MAX_ATTEMPTS) {
    return Response.json(
      { error: "Demasiados intentos. Espera 15 minutos." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  if (typeof body?.password !== "string" || body.password.length > 1024 || !verifyPassword(body.password)) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return Response.json({ error: "Clave incorrecta" }, { status: 401 });
  }

  await createSession();
  return Response.json({ ok: true });
}
