import { z } from "zod";
import { getSql, isDatabaseConfigured } from "@/db";
import { hasJefaturaSession } from "@/lib/auth";
import { getAppData } from "@/lib/data";
import { readNovemberData } from "@/lib/november-data";
import { NEW_SYSTEM_START, weekStart } from "@/lib/november-system";
import { SHIFT_COLOR_KEYS } from "@/lib/shift-colors";

const id = z.string().min(1).max(100);
const absence = z.object({
  id, doctorId: id, startDate: z.iso.date(), endDate: z.iso.date(),
  reason: z.enum(["licencia", "vacaciones", "pasantia", "otro"]),
  note: z.string().max(300).optional(),
});
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("oncall.set"), weekStart: z.iso.date(),
    doctorIds: z.array(z.union([id, z.literal("")])).length(3),
    colorKeys: z.array(z.union([z.null(), z.string().refine((value) => SHIFT_COLOR_KEYS.includes(value as typeof SHIFT_COLOR_KEYS[number]))])).length(3),
  }),
  z.object({ type: z.literal("absence.add"), absence }),
  z.object({ type: z.literal("absence.delete"), id }),
  z.object({ type: z.literal("freeze.add"), freeze: z.object({
    id, doctorId: id, startDate: z.iso.date(), endDate: z.iso.date(),
  }) }),
  z.object({ type: z.literal("freeze.delete"), id }),
  z.object({ type: z.literal("base.set"), assignmentId: id, worked: z.boolean(),
    reason: z.string().trim().min(3).max(300) }),
  z.object({ type: z.literal("base.delete"), assignmentId: id }),
]);

async function ready() {
  if (!(await hasJefaturaSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Base de datos no configurada" }, { status: 503 });
  return null;
}

export async function GET() {
  const error = await ready();
  if (error) return error;
  const data = await getAppData();
  return Response.json({ ...await readNovemberData(data), doctors: data.doctors });
}

export async function POST(request: Request) {
  const error = await ready();
  if (error) return error;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Solicitud inválida" }, { status: 400 });
  const action = parsed.data;
  const data = await getAppData();
  const transition = await readNovemberData(data);
  const sql = getSql();
  if (action.type === "oncall.set") {
    const selected = action.doctorIds.filter(Boolean);
    if (action.weekStart !== weekStart(action.weekStart) || action.weekStart < weekStart(NEW_SYSTEM_START) ||
      !transition.onCallWeeks.some((item) => item.weekStart === action.weekStart) ||
      new Set(selected).size !== selected.length) {
      return Response.json({ error: "Semana o médicos de llamado inválidos" }, { status: 400 });
    }
    const end = new Date(action.weekStart + "T12:00:00");
    end.setDate(end.getDate() + 6);
    const weekEnd = end.toISOString().slice(0, 10);
    if (selected.some((doctorId) => {
      const doctor = data.doctors.find((item) => item.id === doctorId);
      return !doctor?.active ||
        transition.absences.some((item) => item.doctorId === doctorId &&
          item.startDate <= weekEnd && item.endDate >=
            (action.weekStart < NEW_SYSTEM_START ? NEW_SYSTEM_START : action.weekStart));
    })) return Response.json({ error: "Uno de los médicos no puede quedar de llamado" }, { status: 400 });
    await sql`INSERT INTO on_call_weeks (week_start, doctor_ids, color_keys, manual, needs_review)
      VALUES (${action.weekStart}, ${JSON.stringify(action.doctorIds)}::jsonb, ${JSON.stringify(action.colorKeys)}::jsonb, true, false)
      ON CONFLICT (week_start) DO UPDATE SET doctor_ids = EXCLUDED.doctor_ids,
        color_keys = EXCLUDED.color_keys, manual = true, needs_review = false, updated_at = now()`;
  } else if (action.type === "absence.add") {
    const item = action.absence;
    if (!data.doctors.some((doctor) => doctor.id === item.doctorId) || item.endDate < item.startDate)
      return Response.json({ error: "Médico o intervalo inválido" }, { status: 400 });
    await sql`INSERT INTO doctor_absences (id, doctor_id, start_date, end_date, reason, note)
      VALUES (${item.id}, ${item.doctorId}, ${item.startDate}, ${item.endDate}, ${item.reason}, ${item.note ?? null})
      ON CONFLICT (id) DO UPDATE SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
        reason = EXCLUDED.reason, note = EXCLUDED.note`;
    await sql`UPDATE on_call_weeks SET needs_review = true WHERE doctor_ids ? ${item.doctorId}
      AND week_start <= ${item.endDate}::date AND week_start + 6 >= ${item.startDate}::date`;
  } else if (action.type === "absence.delete") {
    const removed = transition.absences.find((item) => item.id === action.id);
    await sql`DELETE FROM doctor_absences WHERE id = ${action.id}`;
    if (removed) await sql`UPDATE on_call_weeks SET needs_review = true
      WHERE doctor_ids ? ${removed.doctorId} AND week_start <= ${removed.endDate}::date
      AND week_start + 6 >= ${removed.startDate}::date`;
  } else if (action.type === "freeze.add") {
    const item = action.freeze;
    const days = Math.round((Date.parse(item.endDate + "T12:00:00Z") -
      Date.parse(item.startDate + "T12:00:00Z")) / 86400000) + 1;
    if (!data.doctors.some((doctor) => doctor.id === item.doctorId) || days < 14)
      return Response.json({ error: "La pausa debe durar al menos 14 días" }, { status: 400 });
    await sql`INSERT INTO point_freezes (id, doctor_id, start_date, end_date)
      VALUES (${item.id}, ${item.doctorId}, ${item.startDate}, ${item.endDate})`;
  } else if (action.type === "freeze.delete") {
    await sql`DELETE FROM point_freezes WHERE id = ${action.id}`;
  } else if (action.type === "base.set") {
    const assignment = data.schedules.filter((item) => item.status === "published")
      .flatMap((item) => item.assignments).find((item) => item.id === action.assignmentId);
    if (!assignment || assignment.date < NEW_SYSTEM_START)
      return Response.json({ error: "Turno propio no encontrado" }, { status: 400 });
    await sql`INSERT INTO base_corrections (assignment_id, worked, reason)
      VALUES (${action.assignmentId}, ${action.worked}, ${action.reason})
      ON CONFLICT (assignment_id) DO UPDATE SET worked = EXCLUDED.worked,
        reason = EXCLUDED.reason, updated_at = now()`;
  } else {
    await sql`DELETE FROM base_corrections WHERE assignment_id = ${action.assignmentId}`;
  }
  return Response.json({ ok: true });
}
