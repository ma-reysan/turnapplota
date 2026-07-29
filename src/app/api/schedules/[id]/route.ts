import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  auditEvents,
  scheduleMonths,
  shiftAssignments,
} from "@/db/schema";
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
  await db.transaction(async (transaction) => {
    await transaction
      .insert(scheduleMonths)
      .values({
        id,
        year,
        month,
        status: parsed.data.publish ? "published" : "draft",
        version: nextVersion,
      })
      .onConflictDoUpdate({
        target: scheduleMonths.id,
        set: {
          status: parsed.data.publish ? "published" : "draft",
          version: nextVersion,
          updatedAt: new Date(),
        },
      });
    await transaction.delete(shiftAssignments).where(eq(shiftAssignments.scheduleId, id));
    if (parsed.data.assignments.length) {
      await transaction.insert(shiftAssignments).values(
        parsed.data.assignments.map((assignment) => ({
          ...assignment,
          scheduleId: id,
          shiftDate: assignment.date,
        })),
      );
    }
    await transaction.insert(auditEvents).values({
      action: parsed.data.publish ? "schedule.published" : "schedule.saved",
      entityType: "schedule",
      entityId: id,
      before: current[0] ?? null,
      after: { assignments: parsed.data.assignments.length },
    });
  });
  return Response.json({ ok: true, version: nextVersion });
}
