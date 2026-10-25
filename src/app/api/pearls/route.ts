import { z } from "zod";
import { getSql, isDatabaseConfigured } from "@/db";
import { hasJefaturaSession } from "@/lib/auth";

const input = z.object({
  version: z.enum(["current", "future"]),
  lines: z.array(z.string().trim().min(1).max(1000)).min(1).max(100),
});

export async function PUT(request: Request) {
  if (!(await hasJefaturaSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Base de datos no configurada" }, { status: 503 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Revisa las perlas: cada línea debe tener entre 1 y 1000 caracteres." }, { status: 400 });
  const { version, lines } = parsed.data;
  const sql = getSql();
  await sql.transaction([
    sql`INSERT INTO pearl_versions (version, lines, updated_at) VALUES (${version}, ${JSON.stringify(lines)}::jsonb, now())
      ON CONFLICT (version) DO UPDATE SET lines = EXCLUDED.lines, updated_at = now()`,
    sql`INSERT INTO audit_events (action, entity_type, entity_id, after)
      VALUES ('pearls.updated', 'pearl_versions', ${version}, ${JSON.stringify({ lines })}::jsonb)`,
  ]);
  return Response.json({ ok: true, lines });
}
