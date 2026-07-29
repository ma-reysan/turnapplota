import { addDays } from "date-fns";
import { getSql, isDatabaseConfigured } from "@/db";
import { hasJefaturaSession } from "@/lib/auth";
import { replacementInputSchema } from "@/lib/validation";

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
  const expiresAt = addDays(new Date(`${parsed.data.date}T12:00:00`), 120)
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
