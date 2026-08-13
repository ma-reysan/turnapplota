import { asc, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { auditEvents, protocols } from "@/db/schema";
import { protocolDeleteSchema, protocolInputSchema } from "@/lib/validation";

export async function GET() {
  if (!isDatabaseConfigured()) return Response.json([]);
  const rows = await getDb().select().from(protocols).orderBy(asc(protocols.category), asc(protocols.title));
  return Response.json(rows);
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ error: "Base de datos no configurada" }, { status: 503 });
  const parsed = protocolInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const input = parsed.data;
  const db = getDb();
  const [row] = input.id
    ? await db.update(protocols).set({ ...input, updatedAt: new Date() }).where(eq(protocols.id, input.id)).returning()
    : await db.insert(protocols).values(input).returning();
  if (!row) return Response.json({ error: "Protocolo no encontrado" }, { status: 404 });
  await db.insert(auditEvents).values({
    action: input.id ? "protocol.updated" : "protocol.created",
    entityType: "protocol",
    entityId: row.id,
    after: row,
    actor: input.updatedBy,
  });
  return Response.json(row);
}

export async function DELETE(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ error: "Base de datos no configurada" }, { status: 503 });
  const parsed = protocolDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const [removed] = await getDb().delete(protocols).where(eq(protocols.id, parsed.data.id)).returning();
  if (!removed) return Response.json({ error: "Protocolo no encontrado" }, { status: 404 });
  await getDb().insert(auditEvents).values({
    action: "protocol.deleted",
    entityType: "protocol",
    entityId: removed.id,
    before: removed,
    actor: parsed.data.updatedBy,
  });
  return Response.json({ ok: true });
}
