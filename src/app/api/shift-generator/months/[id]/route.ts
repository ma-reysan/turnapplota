import { asc, eq, lt } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { shiftGeneratorMonths } from "@/db/schema";
import { hasJefaturaSession } from "@/lib/auth";
import { createGeneratorDraft } from "@/lib/shift-generator";
import type {
  GeneratorAbsence,
  GeneratorAssignment,
  GeneratorBalance,
  GeneratorWarning,
} from "@/lib/types";
import { generatorMonthSchema } from "@/lib/validation";

function rowToDraft(row: typeof shiftGeneratorMonths.$inferSelect) {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    startLane: row.startLane,
    absences: row.absences as GeneratorAbsence[],
    balances: row.balances as GeneratorBalance[],
    assignments: row.assignments as GeneratorAssignment[],
    generatedNotes: row.generatedNotes,
    manualNotes: row.manualNotes,
    warnings: row.warnings as GeneratorWarning[],
    version: row.version,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await hasJefaturaSession())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return Response.json({ error: "Configura DATABASE_URL para usar el generador." }, { status: 503 });
  }
  const { id } = await params;
  if (!/^\d{4}-\d{2}$/.test(id)) {
    return Response.json({ error: "Mes inválido" }, { status: 400 });
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(shiftGeneratorMonths)
    .where(eq(shiftGeneratorMonths.id, id));
  if (rows[0]) return Response.json(rowToDraft(rows[0]));

  const previous = await db
    .select()
    .from(shiftGeneratorMonths)
    .where(lt(shiftGeneratorMonths.id, id))
    .orderBy(asc(shiftGeneratorMonths.id));
  const last = previous.at(-1);
  const startLane = last
    ? (last.startLane + new Date(last.year, last.month, 0, 12).getDate()) % 6
    : 0;
  return Response.json(createGeneratorDraft(id, startLane));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await hasJefaturaSession())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return Response.json({ error: "Configura DATABASE_URL para guardar el borrador." }, { status: 503 });
  }
  const { id } = await params;
  const parsed = generatorMonthSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.id !== id) {
    return Response.json(
      { error: parsed.success ? "Mes inválido" : parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(shiftGeneratorMonths)
    .where(eq(shiftGeneratorMonths.id, id));
  if (rows[0] && rows[0].version !== parsed.data.version) {
    return Response.json(
      { error: "El borrador cambió en otra sesión. Recarga antes de guardar." },
      { status: 409 },
    );
  }
  const nextVersion = rows[0] ? rows[0].version + 1 : 1;
  const values = {
    id,
    year: parsed.data.year,
    month: parsed.data.month,
    startLane: parsed.data.startLane,
    absences: parsed.data.absences,
    balances: parsed.data.balances,
    assignments: parsed.data.assignments,
    generatedNotes: parsed.data.generatedNotes,
    manualNotes: parsed.data.manualNotes,
    warnings: parsed.data.warnings,
    version: nextVersion,
  };
  await db
    .insert(shiftGeneratorMonths)
    .values(values)
    .onConflictDoUpdate({
      target: shiftGeneratorMonths.id,
      set: { ...values, updatedAt: new Date() },
    });
  return Response.json({ ok: true, version: nextVersion });
}
