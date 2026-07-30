import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { auditEvents, vacations } from "@/db/schema";
import { hasJefaturaSession } from "@/lib/auth";
import { vacationInputSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await hasJefaturaSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Configura DATABASE_URL para guardar cambios." }, { status: 503 });
  const parsed = vacationInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const db = getDb();
  const [vacation] = await db.insert(vacations).values(parsed.data).returning();
  await db.insert(auditEvents).values({ action: "vacation.created", entityType: "vacation", entityId: vacation.id, after: vacation });
  return Response.json({ vacation });
}

export async function DELETE(request: Request) {
  if (!(await hasJefaturaSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = (await request.json().catch(() => null) as { id?: string } | null)?.id;
  if (!id) return Response.json({ error: "Vacación no válida" }, { status: 400 });
  const db = getDb();
  const [removed] = await db.delete(vacations).where(eq(vacations.id, id)).returning();
  if (!removed) return Response.json({ error: "Vacación no encontrada" }, { status: 404 });
  await db.insert(auditEvents).values({ action: "vacation.deleted", entityType: "vacation", entityId: id, before: removed });
  return Response.json({ ok: true });
}
