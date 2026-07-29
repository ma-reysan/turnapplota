import { eq } from "drizzle-orm";
import { getDb, getSql, isDatabaseConfigured } from "@/db";
import { scheduleMonths } from "@/db/schema";
import { hasJefaturaSession } from "@/lib/auth";
import { scheduleUpdateSchema } from "@/lib/validation";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await hasJefaturaSession())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return Response.json(
      { error: "Configura DATABASE_URL para guardar cambios." },
      { status: 503 },
    );
  }
  const { id } = await params;
  const parsed = scheduleUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.id !== id) {
    return Response.json(
      { error: parsed.success ? "Mes inválido" : parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const db = getDb();
  const current = await db.select().from(scheduleMonths).where(eq(scheduleMonths.id, id));
  if (current[0] && current[0].version !== parsed.data.version) {
    return Response.json(
      { error: "El calendario cambió en otra sesión. Recarga antes de guardar." },
      { status: 409 },
    );
  }

  const [year, month] = id.split("-").map(Number);
  const nextVersion = current[0] ? parsed.data.version + 1 : 1;
  const status = parsed.data.publish ? "published" : "draft";
  const sql = getSql();
  const assignmentQueries = parsed.data.assignments.map(
    (assignment) => sql`
      INSERT INTO shift_assignments (
        id, schedule_id, shift_date, kind, slot, doctor_id
      ) VALUES (
        ${assignment.id}, ${id}, ${assignment.date}, ${assignment.kind},
        ${assignment.slot}, ${assignment.doctorId}
      )
    `,
  );
  await sql.transaction([
    sql`
      INSERT INTO schedule_months (id, year, month, status, version)
      VALUES (${id}, ${year}, ${month}, ${status}, ${nextVersion})
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        version = EXCLUDED.version,
        updated_at = now()
    `,
    sql`DELETE FROM shift_assignments WHERE schedule_id = ${id}`,
    ...assignmentQueries,
    sql`
      INSERT INTO audit_events (
        action, entity_type, entity_id, before, after
      ) VALUES (
        ${parsed.data.publish ? "schedule.published" : "schedule.saved"},
        'schedule',
        ${id},
        ${JSON.stringify(current[0] ?? null)}::jsonb,
        ${JSON.stringify({ assignments: parsed.data.assignments.length })}::jsonb
      )
    `,
  ]);
  return Response.json({ ok: true, version: nextVersion });
}
