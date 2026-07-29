import { createSession, identityHash, verifyPassword } from "@/lib/auth";

const attempts = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  const identity = identityHash(
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local",
  );
  const now = Date.now();
  const recent = (attempts.get(identity) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    return Response.json(
      { error: "Demasiados intentos. Espera 15 minutos." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || !verifyPassword(body.password)) {
    attempts.set(identity, [...recent, now]);
    await new Promise((resolve) => setTimeout(resolve, 350));
    return Response.json({ error: "Clave incorrecta" }, { status: 401 });
  }

  attempts.delete(identity);
  await createSession();
  return Response.json({ ok: true });
}
