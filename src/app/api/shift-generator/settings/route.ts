import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { shiftGeneratorSettings } from "@/db/schema";
import { hasJefaturaSession } from "@/lib/auth";
import { createDefaultGeneratorSettings, validateGeneratorSettings } from "@/lib/shift-generator";
import type { GeneratorLane, GeneratorWildcard } from "@/lib/types";
import { generatorSettingsSchema } from "@/lib/validation";

export async function GET() {
  if (!(await hasJefaturaSession())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return Response.json({ error: "Configura DATABASE_URL para usar el generador." }, { status: 503 });
  }
  const rows = await getDb()
    .select()
    .from(shiftGeneratorSettings)
    .where(eq(shiftGeneratorSettings.id, "default"));
  const row = rows[0];
  if (!row) return Response.json(createDefaultGeneratorSettings());
  return Response.json({
    id: "default",
    lanes: row.lanes as GeneratorLane[],
    wildcard: row.wildcard as GeneratorWildcard,
    version: row.version,
  });
}

export async function PUT(request: Request) {
  if (!(await hasJefaturaSession())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return Response.json({ error: "Configura DATABASE_URL para guardar la configuración." }, { status: 503 });
  }
  const parsed = generatorSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const businessErrors = validateGeneratorSettings(parsed.data);
  if (businessErrors.length) {
    return Response.json({ error: businessErrors[0] }, { status: 400 });
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(shiftGeneratorSettings)
    .where(eq(shiftGeneratorSettings.id, "default"));
  if (rows[0] && rows[0].version !== parsed.data.version) {
    return Response.json(
      { error: "La configuración cambió en otra sesión. Recarga antes de guardar." },
      { status: 409 },
    );
  }
  const nextVersion = rows[0] ? rows[0].version + 1 : 1;
  await db
    .insert(shiftGeneratorSettings)
    .values({
      id: "default",
      lanes: parsed.data.lanes,
      wildcard: parsed.data.wildcard,
      version: nextVersion,
    })
    .onConflictDoUpdate({
      target: shiftGeneratorSettings.id,
      set: {
        lanes: parsed.data.lanes,
        wildcard: parsed.data.wildcard,
        version: nextVersion,
        updatedAt: new Date(),
      },
    });
  return Response.json({ ok: true, version: nextVersion });
}
