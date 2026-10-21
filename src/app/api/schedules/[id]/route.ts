import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, getSql, isDatabaseConfigured } from "@/db";
import { scheduleMonths, shiftAssignments, shiftMarkers } from "@/db/schema";
import { hasJefaturaSession } from "@/lib/auth";
import { findNightToDayConflicts } from "@/lib/schedule-conflicts";
import { schedulePatchSchema } from "@/lib/validation";

function shiftDateByDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function duplicateDoctorShiftKeys(assignments: Array<{ date: string; kind: "DAY" | "NIGHT"; doctorId: string }>) {
  const counts = new Map<string, number>();
  for (const assignment of assignments) {
    const key = `${assignment.date}:${assignment.kind}:${assignment.doctorId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

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
  const monthEnd = `${id}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
  const rangeStart = shiftDateByDays(`${id}-01`, -1);
  const rangeEnd = shiftDateByDays(monthEnd, 1);
  const db = getDb();
  const existingRows = await db.select().from(shiftAssignments).where(and(
    gte(shiftAssignments.shiftDate, rangeStart),
    lte(shiftAssignments.shiftDate, rangeEnd),
  ));
  const existingAssignments = existingRows.map((row) => ({
    id: row.id,
    date: row.shiftDate,
    kind: row.kind,
    slot: row.slot,
    doctorId: row.doctorId,
  }));
  const nextBySlot = new Map(existingAssignments.map((item) => [`${item.date}:${item.kind}:${item.slot}`, item]));
  for (const assignment of assignments) {
    const key = `${assignment.date}:${assignment.kind}:${assignment.slot}`;
    nextBySlot.delete(key);
    if (assignment.doctorId) nextBySlot.set(key, { id: key, ...assignment, doctorId: assignment.doctorId });
  }
  const nextAssignments = [...nextBySlot.values()];
  const existingDuplicateKeys = duplicateDoctorShiftKeys(existingAssignments);
  const nextDuplicateKeys = duplicateDoctorShiftKeys(nextAssignments);
  const introducedDuplicates = [...nextDuplicateKeys].filter((key) => !existingDuplicateKeys.has(key));
  const existingConflictKeys = new Set(findNightToDayConflicts(existingAssignments).map((item) => `${item.doctorId}:${item.nightDate}:${item.dayDate}`));
  const nextConflicts = findNightToDayConflicts(nextAssignments);
  const introducedConflicts = nextConflicts.filter((item) => !existingConflictKeys.has(`${item.doctorId}:${item.nightDate}:${item.dayDate}`));
  if (introducedDuplicates.length || (publish ? nextDuplicateKeys.size : false)) {
    return Response.json({ error: "Un médico no puede ocupar dos puestos del mismo turno" }, { status: 400 });
  }
  if (introducedConflicts.length || (publish && nextConflicts.length)) {
    const conflict = introducedConflicts[0] ?? nextConflicts[0];
    return Response.json({ error: `Un turno de noche no puede ir seguido de un turno de día (${conflict.nightDate}–${conflict.dayDate})` }, { status: 400 });
  }
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
        status = CASE WHEN ${publish} THEN 'published'::schedule_status ELSE schedule_months.status END,
        version = schedule_months.version + 1,
        updated_at = now()
    `,
    ...assignmentQueries,
    ...markerQueries,
    sql`INSERT INTO audit_events (action, entity_type, entity_id, after) VALUES (${publish ? "schedule.published" : "schedule.autosaved"}, 'schedule', ${id}, ${JSON.stringify({ assignments: assignments.length, markers: markers.length })}::jsonb)`,
  ]);
  const updated = await db.select().from(scheduleMonths).where(eq(scheduleMonths.id, id));
  return Response.json({ ok: true, version: updated[0]?.version ?? 1, status: updated[0]?.status ?? "draft" });
}

export async function PUT() {
  return Response.json({ error: "Esta versión de guardado ya no está disponible. Recarga la aplicación." }, { status: 410 });
}
