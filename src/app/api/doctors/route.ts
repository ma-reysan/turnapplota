import { eq } from "drizzle-orm";
import { getDb, getSql, isDatabaseConfigured } from "@/db";
import { doctors } from "@/db/schema";
import { hasJefaturaSession } from "@/lib/auth";
import { doctorInputSchema } from "@/lib/validation";

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
  const parsed = doctorInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const db = getDb();
  const before = await db.select().from(doctors).where(eq(doctors.id, parsed.data.id));
  const sameShortName = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(eq(doctors.shortName, parsed.data.shortName));
  if (sameShortName.some((doctor) => doctor.id !== parsed.data.id)) {
    return Response.json(
      { error: "Ese nombre corto ya pertenece a otro médico." },
      { status: 409 },
    );
  }
  const input = parsed.data;
  const sql = getSql();
  await sql.transaction([
    sql`INSERT INTO doctors (id, short_name, long_name, active, sort_order)
      VALUES (${input.id}, ${input.shortName}, ${input.longName}, ${input.active}, ${input.sortOrder})
      ON CONFLICT (id) DO UPDATE SET short_name = EXCLUDED.short_name,
        long_name = EXCLUDED.long_name, active = EXCLUDED.active,
        sort_order = EXCLUDED.sort_order, updated_at = now()`,
    sql`INSERT INTO audit_events (action, entity_type, entity_id, before, after)
      VALUES (${before.length ? "doctor.updated" : "doctor.created"}, 'doctor', ${input.id},
        ${JSON.stringify(before[0] ?? null)}::jsonb, ${JSON.stringify(input)}::jsonb)`,
  ]);
  return Response.json({ ok: true });
}
