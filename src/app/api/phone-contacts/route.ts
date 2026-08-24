import { asc, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { phoneContacts } from "@/db/schema";
import { normalizePhoneService } from "@/lib/phone-directory";
import { phoneContactDeleteSchema, phoneContactInputSchema } from "@/lib/validation";

export async function GET() {
  if (!isDatabaseConfigured()) return Response.json([]);
  return Response.json(await getDb().select().from(phoneContacts).orderBy(asc(phoneContacts.establishment), asc(phoneContacts.service)));
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ error: "Base de datos no configurada" }, { status: 503 });
  const parsed = phoneContactInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const input = { ...parsed.data, service: normalizePhoneService(parsed.data.service), phones: [...new Set(parsed.data.phones.map((phone) => phone.trim()))] };
  const db = getDb();
  const [row] = input.id
    ? await db.update(phoneContacts).set({ ...input, sourceNeedsReview: false, updatedAt: new Date() }).where(eq(phoneContacts.id, input.id)).returning()
    : await db.insert(phoneContacts).values({ ...input, sourceNeedsReview: false }).returning();
  if (!row) return Response.json({ error: "Contacto no encontrado" }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ error: "Base de datos no configurada" }, { status: 503 });
  const parsed = phoneContactDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const [removed] = await getDb().delete(phoneContacts).where(eq(phoneContacts.id, parsed.data.id)).returning();
  if (!removed) return Response.json({ error: "Contacto no encontrado" }, { status: 404 });
  return Response.json({ ok: true });
}
