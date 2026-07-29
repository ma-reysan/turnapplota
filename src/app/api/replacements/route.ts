import { addDays } from "date-fns";
import { getDb, isDatabaseConfigured } from "@/db";
import { auditEvents, replacements } from "@/db/schema";
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
  const db = getDb();
  const record = { ...parsed.data, replacementDate: parsed.data.date, expiresAt };
  await db.transaction(async (transaction) => {
    await transaction.insert(replacements).values(record);
    await transaction.insert(auditEvents).values({
      action: "replacement.created",
      entityType: "replacement",
      entityId: parsed.data.id,
      after: record,
    });
  });
  return Response.json({ ok: true });
}
