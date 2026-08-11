import { getSql, isDatabaseConfigured } from "@/db";
import { hasJefaturaSession } from "@/lib/auth";
import { shiftColorLegendSchema } from "@/lib/validation";

export async function PUT(request: Request) {
  if (!(await hasJefaturaSession())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return Response.json(
      { error: "Configura DATABASE_URL para guardar cambios." },
      { status: 503 },
    );
  }

  const parsed = shiftColorLegendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Leyenda inválida" },
      { status: 400 },
    );
  }

  const sql = getSql();
  await sql.transaction(
    parsed.data.items.map(
      (item) => sql`
        INSERT INTO shift_color_legend (color_key, label)
        VALUES (${item.key}, ${item.label})
        ON CONFLICT (color_key) DO UPDATE SET
          label = EXCLUDED.label,
          updated_at = now()
      `,
    ),
  );

  return Response.json({ ok: true, items: parsed.data.items });
}
