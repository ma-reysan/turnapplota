import { asc } from "drizzle-orm";
import { getDb, getSql, isDatabaseConfigured } from "@/db";
import { protocols } from "@/db/schema";
import { protocolDeleteSchema, protocolInputSchema } from "@/lib/validation";

export async function GET() {
  if (!isDatabaseConfigured()) return Response.json([]);
  const rows = await getDb().select().from(protocols).orderBy(asc(protocols.category), asc(protocols.title));
  return Response.json(rows);
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ error: "Base de datos no configurada" }, { status: 503 });
  const parsed = protocolInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const input = parsed.data;
  const sql = getSql();
  const savedRows = (input.id
    ? await sql`WITH saved AS (
        UPDATE protocols SET title = ${input.title}, url = ${input.url},
          category = ${input.category}::protocol_category, updated_by = ${input.updatedBy}, updated_at = now()
        WHERE id = ${input.id} RETURNING *
      ), logged AS (
        INSERT INTO audit_events (action, entity_type, entity_id, after, actor)
        SELECT 'protocol.updated', 'protocol', id::text, to_jsonb(saved), ${input.updatedBy} FROM saved
      ) SELECT * FROM saved`
    : await sql`WITH saved AS (
        INSERT INTO protocols (title, url, category, updated_by)
        VALUES (${input.title}, ${input.url}, ${input.category}::protocol_category, ${input.updatedBy}) RETURNING *
      ), logged AS (
        INSERT INTO audit_events (action, entity_type, entity_id, after, actor)
        SELECT 'protocol.created', 'protocol', id::text, to_jsonb(saved), ${input.updatedBy} FROM saved
      ) SELECT * FROM saved`) as Record<string, unknown>[];
  const [row] = savedRows;
  if (!row) return Response.json({ error: "Protocolo no encontrado" }, { status: 404 });
  return Response.json({ id: row.id, title: row.title, url: row.url, category: row.category,
    updatedBy: row.updated_by, createdAt: row.created_at, updatedAt: row.updated_at });
}

export async function DELETE(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ error: "Base de datos no configurada" }, { status: 503 });
  const parsed = protocolDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const sql = getSql();
  const removedRows = await sql`WITH removed AS (
    DELETE FROM protocols WHERE id = ${parsed.data.id} RETURNING *
  ), logged AS (
    INSERT INTO audit_events (action, entity_type, entity_id, before, actor)
    SELECT 'protocol.deleted', 'protocol', id::text, to_jsonb(removed), ${parsed.data.updatedBy} FROM removed
  ) SELECT id FROM removed` as Record<string, unknown>[];
  const [removed] = removedRows;
  if (!removed) return Response.json({ error: "Protocolo no encontrado" }, { status: 404 });
  return Response.json({ ok: true });
}
