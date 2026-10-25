import { getSql, isDatabaseConfigured } from "@/db";
import { hasJefaturaSession } from "@/lib/auth";
import { isThemeChoice } from "@/lib/accent-theme";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

// The latest publication event is the durable source of the global theme.
// Reuse the existing audit log so publication needs no schema migration.
export async function GET() {
  if (!isDatabaseConfigured()) return Response.json({ error: "Base de datos no configurada" }, { status: 503, headers });
  try {
    const sql = getSql();
    const rows = await sql`SELECT id, after->>'theme' AS theme FROM audit_events
      WHERE action = 'appearance.published' AND entity_type = 'appearance' AND entity_id = 'global'
      ORDER BY created_at DESC, id DESC LIMIT 1` as Array<{ id: string; theme: string }>;
    const row = rows[0];
    return Response.json(row && isThemeChoice(row.theme)
      ? { theme: row.theme, revision: row.id }
      : { theme: "auto", revision: "initial" }, { headers });
  } catch {
    return Response.json({ error: "No se pudo cargar el tema publicado" }, { status: 503, headers });
  }
}

export async function PUT(request: Request) {
  if (!(await hasJefaturaSession())) return Response.json({ error: "No autorizado" }, { status: 401, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origen no autorizado" }, { status: 403, headers });
  const input = await request.json().catch(() => null);
  if (!input || !isThemeChoice(input.theme)) return Response.json({ error: "Tema no válido" }, { status: 400, headers });
  if (!isDatabaseConfigured()) return Response.json({ error: "Base de datos no configurada" }, { status: 503, headers });
  try {
    const sql = getSql();
    const results = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(824601)`,
      sql`INSERT INTO audit_events (action, entity_type, entity_id, after, created_at)
        VALUES ('appearance.published', 'appearance', 'global', ${JSON.stringify({ theme: input.theme })}::jsonb, clock_timestamp())
        RETURNING id`,
    ]);
    return Response.json({ theme: input.theme, revision: (results[1] as Array<{ id: string }>)[0].id }, { headers });
  } catch {
    return Response.json({ error: "No se pudo publicar el tema. La vista previa sigue siendo local." }, { status: 503, headers });
  }
}
