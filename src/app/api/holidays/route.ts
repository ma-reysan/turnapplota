import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { auditEvents, holidays } from "@/db/schema";
import { hasJefaturaSession } from "@/lib/auth";
import { holidayInputSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await hasJefaturaSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Configura DATABASE_URL para guardar cambios." }, { status: 503 });
  const parsed = holidayInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const db = getDb();
  const [holiday] = await db.insert(holidays).values({ holidayDate: parsed.data.date, label: parsed.data.label }).onConflictDoUpdate({ target: holidays.holidayDate, set: { label: parsed.data.label } }).returning();
  await db.insert(auditEvents).values({ action: "holiday.saved", entityType: "holiday", entityId: holiday.holidayDate, after: holiday });
  return Response.json({ holiday: { date: holiday.holidayDate, label: holiday.label } });
}

export async function DELETE(request: Request) {
  if (!(await hasJefaturaSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  const date = (await request.json().catch(() => null) as { date?: string } | null)?.date;
  if (!date) return Response.json({ error: "Fecha no válida" }, { status: 400 });
  const db = getDb();
  const [removed] = await db.delete(holidays).where(eq(holidays.holidayDate, date)).returning();
  if (!removed) return Response.json({ error: "Feriado no encontrado" }, { status: 404 });
  await db.insert(auditEvents).values({ action: "holiday.deleted", entityType: "holiday", entityId: date, before: removed });
  return Response.json({ ok: true });
}
