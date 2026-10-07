import { getSql, isDatabaseConfigured } from "@/db";
import { hasJefaturaSession } from "@/lib/auth";
import { holidayInputSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await hasJefaturaSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Configura DATABASE_URL para guardar cambios." }, { status: 503 });
  const parsed = holidayInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const sql = getSql();
  const savedRows = await sql`WITH saved AS (
    INSERT INTO holidays (holiday_date, label) VALUES (${parsed.data.date}, ${parsed.data.label})
    ON CONFLICT (holiday_date) DO UPDATE SET label = EXCLUDED.label RETURNING *
  ), logged AS (
    INSERT INTO audit_events (action, entity_type, entity_id, after)
    SELECT 'holiday.saved', 'holiday', holiday_date::text, to_jsonb(saved) FROM saved
  ) SELECT holiday_date, label FROM saved` as Record<string, unknown>[];
  const [holiday] = savedRows;
  return Response.json({ holiday: { date: holiday.holiday_date, label: holiday.label } });
}

export async function DELETE(request: Request) {
  if (!(await hasJefaturaSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  const date = (await request.json().catch(() => null) as { date?: string } | null)?.date;
  if (!date) return Response.json({ error: "Fecha no válida" }, { status: 400 });
  const sql = getSql();
  const removedRows = await sql`WITH removed AS (
    DELETE FROM holidays WHERE holiday_date = ${date} RETURNING *
  ), logged AS (
    INSERT INTO audit_events (action, entity_type, entity_id, before)
    SELECT 'holiday.deleted', 'holiday', holiday_date::text, to_jsonb(removed) FROM removed
  ) SELECT holiday_date FROM removed` as Record<string, unknown>[];
  const [removed] = removedRows;
  if (!removed) return Response.json({ error: "Feriado no encontrado" }, { status: 404 });
  return Response.json({ ok: true });
}
