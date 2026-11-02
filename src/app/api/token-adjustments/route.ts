import { z } from "zod";
import { getSql, isDatabaseConfigured } from "@/db";
import { hasJefaturaSession } from "@/lib/auth";
import { getAppData } from "@/lib/data";
import { availableFichas, santiagoParts, weekStart } from "@/lib/november-system";

const input = z.object({ id: z.uuid(), doctorId: z.string().min(1), delta: z.union([z.literal(1), z.literal(-1)]) });

export async function POST(request: Request) {
  if (!(await hasJefaturaSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Base de datos no configurada" }, { status: 503 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ajuste inválido" }, { status: 400 });
  const { id, doctorId, delta } = parsed.data;
  const data = await getAppData();
  if (!data.doctors.some((doctor) => doctor.id === doctorId && doctor.active))
    return Response.json({ error: "Médico inactivo o inexistente" }, { status: 400 });
  const date = santiagoParts(new Date()).date;
  const monday = weekStart(date);
  const balance = availableFichas(data.replacements, doctorId, date, data.tokenAdjustments ?? []);
  if (balance === null || balance + delta < 0 || balance + delta > 2)
    return Response.json({ error: "El ajuste debe dejar entre 0 y 2 fichas" }, { status: 409 });
  const sql = getSql();
  await sql.transaction([
    sql`INSERT INTO token_adjustments (id, doctor_id, week_start, delta)
      VALUES (${id}, ${doctorId}, ${monday}, ${delta})`,
    sql`INSERT INTO audit_events (action, entity_type, entity_id, after)
      VALUES ('token.adjusted', 'token_adjustment', ${id},
        ${JSON.stringify({ id, doctorId, weekStart: monday, delta })}::jsonb)`,
  ]);
  const updated = await getAppData();
  return Response.json({ adjustments: updated.tokenAdjustments ?? [] });
}
