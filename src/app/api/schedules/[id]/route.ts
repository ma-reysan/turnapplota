import { eq } from "drizzle-orm";
import { getDb, getSql, isDatabaseConfigured } from "@/db";
import { scheduleMonths, shiftAssignments, shiftMarkers } from "@/db/schema";
import { hasJefaturaSession } from "@/lib/auth";
import { schedulePatchSchema, scheduleUpdateSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await hasJefaturaSession())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return Response.json(
      { error: "Configura DATABASE_URL para sincronizar cambios." },
      { status: 503 },
    );
  }
  const { id } = await params;
  const db = getDb();
  const current = await db.select().from(scheduleMonths).where(eq(scheduleMonths.id, id));
  if (!current[0]) return Response.json({ error: "Mes no encontrado" }, { status: 404 });
  const [assignments, markers] = await Promise.all([
    db.select().from(shiftAssignments).where(eq(shiftAssignments.scheduleId, id)),
    db.select().from(shiftMarkers).where(eq(shiftMarkers.scheduleId, id)),
  ]);
  return Response.json({
    id: current[0].id,
    year: current[0].year,
    month: current[0].month,
    status: current[0].status,
    version: current[0].version,
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      date: assignment.shiftDate,
      kind: assignment.kind,
      slot: assignment.slot,
      doctorId: assignment.doctorId,
    })),
    markers: markers.map((marker) => ({
      id: marker.id,
      date: marker.shiftDate,
      kind: marker.kind,
      slot: marker.slot,
      colorKey: marker.colorKey,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await hasJefaturaSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Configura DATABASE_URL para guardar cambios." }, { status: 503 });
  const { id } = await params;
  const parsed = schedulePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.id !== id) {
    return Response.json({ error: parsed.success ? "Mes inválido" : parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { assignments, markers, publish = false } = parsed.data;
  const [year, month] = id.split("-").map(Number);
  const sql = getSql();
  const assignmentQueries = assignments.flatMap((assignment) => {
    const remove = sql`DELETE FROM shift_assignments WHERE schedule_id = ${id} AND shift_date = ${assignment.date} AND kind = ${assignment.kind} AND slot = ${assignment.slot}`;
    return assignment.doctorId ? [remove, sql`INSERT INTO shift_assignments (id, schedule_id, shift_date, kind, slot, doctor_id) VALUES (${`${id}-${assignment.date}-${assignment.kind.toLowerCase()}-${assignment.slot}`}, ${id}, ${assignment.date}, ${assignment.kind}, ${assignment.slot}, ${assignment.doctorId})`] : [remove];
  });
  const markerQueries = markers.flatMap((marker) => {
    const remove = sql`DELETE FROM shift_markers WHERE schedule_id = ${id} AND shift_date = ${marker.date} AND kind = ${marker.kind} AND slot = ${marker.slot}`;
    return marker.colorKey ? [remove, sql`INSERT INTO shift_markers (id, schedule_id, shift_date, kind, slot, color_key) VALUES (${`${id}-${marker.date}-${marker.kind.toLowerCase()}-${marker.slot}-color`}, ${id}, ${marker.date}, ${marker.kind}, ${marker.slot}, ${marker.colorKey})`] : [remove];
  });
  await sql.transaction([
    sql`
      INSERT INTO schedule_months (id, year, month, status, version)
      VALUES (${id}, ${year}, ${month}, ${publish ? "published" : "draft"}, 1)
      ON CONFLICT (id) DO UPDATE SET
        status = CASE WHEN ${publish} THEN 'published'::schedule_status ELSE 'draft'::schedule_status END,
        version = schedule_months.version + 1,
        updated_at = now()
    `,
    ...assignmentQueries,
    ...markerQueries,
    sql`INSERT INTO audit_events (action, entity_type, entity_id, after) VALUES (${publish ? "schedule.published" : "schedule.autosaved"}, 'schedule', ${id}, ${JSON.stringify({ assignments: assignments.length, markers: markers.length })}::jsonb)`,
  ]);
  const db = getDb();
  const updated = await db.select().from(scheduleMonths).where(eq(scheduleMonths.id, id));
  return Response.json({ ok: true, version: updated[0]?.version ?? 1, status: updated[0]?.status ?? "draft" });
}

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
  const markerQueries = parsed.data.markers.map(
    (marker) => sql`
      INSERT INTO shift_markers (
        id, schedule_id, shift_date, kind, slot, color_key
      ) VALUES (
        ${marker.id}, ${id}, ${marker.date}, ${marker.kind},
        ${marker.slot}, ${marker.colorKey}
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
    sql`DELETE FROM shift_markers WHERE schedule_id = ${id}`,
    ...assignmentQueries,
    ...markerQueries,
    sql`
      INSERT INTO audit_events (
        action, entity_type, entity_id, before, after
      ) VALUES (
        ${parsed.data.publish ? "schedule.published" : "schedule.saved"},
        'schedule',
        ${id},
        ${JSON.stringify(current[0] ?? null)}::jsonb,
        ${JSON.stringify({
          assignments: parsed.data.assignments.length,
          markers: parsed.data.markers.length,
        })}::jsonb
      )
    `,
  ]);
  return Response.json({ ok: true, version: nextVersion });
}
