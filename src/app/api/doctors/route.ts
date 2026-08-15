import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { auditEvents, doctors } from "@/db/schema";
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
  await db
    .insert(doctors)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: doctors.id,
      set: {
        shortName: parsed.data.shortName,
        longName: parsed.data.longName,
        active: parsed.data.active,
        sortOrder: parsed.data.sortOrder,
        updatedAt: new Date(),
      },
    });
  await db.insert(auditEvents).values({
    action: before.length ? "doctor.updated" : "doctor.created",
    entityType: "doctor",
    entityId: parsed.data.id,
    before: before[0] ?? null,
    after: parsed.data,
  });
  return Response.json({ ok: true });
}
