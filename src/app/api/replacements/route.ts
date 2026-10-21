import { addDays } from "date-fns";
import { getSql, isDatabaseConfigured } from "@/db";
import { hasJefaturaSession } from "@/lib/auth";
import { replacementInputSchema } from "@/lib/validation";
import { getAppData } from "@/lib/data";
import { canVolunteer, NEW_SYSTEM_START } from "@/lib/november-system";

export async function POST(request: Request) {
  if (!(await hasJefaturaSession())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return Response.json(
      { error: "Configura DATABASE_URL para guardar cambios." },
      { status: 503 },
    );
  }
  const parsed = replacementInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  if (parsed.data.typeCode === "BASE" &&
    (parsed.data.points !== 1 || parsed.data.superhero || parsed.data.mode !== "voluntary")) {
    return Response.json({ error: "El punto base debe valer +1" }, { status: 400 });
  }
  if (parsed.data.typeCode !== "BASE" && parsed.data.date >= NEW_SYSTEM_START && parsed.data.mode === "voluntary") {
    const data = await getAppData();
    const hours = parsed.data.typeCode === "FULL_24" || parsed.data.typeCode === "SAT_HOLIDAY_24" ? 24 : 12;
    if (!canVolunteer(data.replacements, parsed.data.doctorId, parsed.data.date, hours)) {
      return Response.json({ error: "Médico sin fichas para otro reemplazo voluntario" }, { status: 409 });
    }
  }
  const expiresAt = addDays(new Date(`${parsed.data.date}T12:00:00Z`), 120)
    .toISOString()
    .slice(0, 10);
  const record = { ...parsed.data, replacementDate: parsed.data.date, expiresAt };
  const sql = getSql();
  await sql.transaction([
    sql`
      INSERT INTO replacements (
        id, replacement_date, doctor_id, type_code, points, mode, superhero, note, expires_at
      ) VALUES (
        ${record.id}, ${record.replacementDate}, ${record.doctorId}, ${record.typeCode},
        ${record.points}, ${record.mode}, ${record.superhero}, ${record.note ?? null},
        ${record.expiresAt}
      )
    `,
    sql`
      INSERT INTO audit_events (action, entity_type, entity_id, after)
      VALUES (
        'replacement.created', 'replacement', ${record.id},
        ${JSON.stringify(record)}::jsonb
      )
    `,
  ]);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await hasJefaturaSession())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return Response.json(
      { error: "Configura DATABASE_URL para guardar cambios." },
      { status: 503 },
    );
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string" || !body.id) {
    return Response.json({ error: "Puntaje inválido" }, { status: 400 });
  }

  const sql = getSql();
  const deleted = await sql`
    WITH removed AS (
      UPDATE replacements
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${body.id} AND deleted_at IS NULL
      RETURNING id, replacement_date, doctor_id, type_code, points, mode, superhero, note, expires_at
    ), audited AS (
      INSERT INTO audit_events (action, entity_type, entity_id, before)
      SELECT
        'replacement.deleted',
        'replacement',
        id,
        jsonb_build_object(
          'id', id,
          'replacementDate', replacement_date,
          'doctorId', doctor_id,
          'typeCode', type_code,
          'points', points,
          'mode', mode,
          'superhero', superhero,
          'note', note,
          'expiresAt', expires_at
        )
      FROM removed
    )
    SELECT id FROM removed
  `;
  if (!Array.isArray(deleted) || !deleted.length) {
    return Response.json({ error: "El puntaje ya no está disponible" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
