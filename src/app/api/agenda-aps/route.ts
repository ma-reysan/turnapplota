import { del, get, put } from "@vercel/blob";
import { desc, eq, isNull } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { apsAgendas, auditEvents } from "@/db/schema";
import { agendaContributorSchema } from "@/lib/validation";

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function currentAgenda() {
  const rows = await getDb()
    .select()
    .from(apsAgendas)
    .where(isNull(apsAgendas.archivedAt))
    .orderBy(desc(apsAgendas.createdAt))
    .limit(1);
  return rows[0];
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ agenda: null });
  const agenda = await currentAgenda();
  if (!agenda) return Response.json({ agenda: null });
  if (new URL(request.url).searchParams.get("download") !== "1") {
    return Response.json({
      agenda: {
        id: agenda.id,
        filename: agenda.filename,
        updatedBy: agenda.updatedBy,
        updatedAt: agenda.createdAt,
      },
    });
  }
  if (!blobConfigured()) return Response.json({ error: "Almacenamiento de archivos no configurado" }, { status: 503 });
  const blobFile = await get(agenda.blobUrl, { access: "private" });
  if (!blobFile || blobFile.statusCode !== 200 || !blobFile.stream) return Response.json({ error: "Archivo no disponible" }, { status: 404 });
  const stream = blobFile.stream;
  return new Response(stream, {
    headers: {
      "Content-Type": agenda.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(agenda.filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured() || !blobConfigured()) {
    return Response.json({ error: "El almacenamiento de Agenda APS aún no está configurado" }, { status: 503 });
  }
  const form = await request.formData();
  const file = form.get("file");
  const parsed = agendaContributorSchema.safeParse({ updatedBy: form.get("updatedBy") });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  if (!(file instanceof File)) {
    return Response.json({ error: "Selecciona un archivo Excel (.xlsx o .xls)" }, { status: 400 });
  }
  const uploadFile = file;
  if (!/\.(xlsx|xls)$/i.test(uploadFile.name)) {
    return Response.json({ error: "Selecciona un archivo Excel (.xlsx o .xls)" }, { status: 400 });
  }
  if (uploadFile.size > 15 * 1024 * 1024) return Response.json({ error: "El archivo supera el máximo de 15 MB" }, { status: 400 });

  const current = await currentAgenda();
  const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const uploaded = await put(`agenda-aps/${crypto.randomUUID()}-${safeName}`, uploadFile, {
    access: "private",
    addRandomSuffix: false,
    contentType: uploadFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const db = getDb();
  const [agenda] = await db.insert(apsAgendas).values({
    blobUrl: uploaded.url,
    blobPath: uploaded.pathname,
    filename: uploadFile.name,
    contentType: uploaded.contentType,
    updatedBy: parsed.data.updatedBy,
  }).returning();
  if (current) {
    await db.update(apsAgendas).set({ archivedAt: new Date() }).where(eq(apsAgendas.id, current.id));
    await del(current.blobUrl).catch(() => undefined);
  }
  await db.insert(auditEvents).values({
    action: "aps_agenda.replaced",
    entityType: "aps_agenda",
    entityId: agenda.id,
    after: { filename: agenda.filename, updatedBy: agenda.updatedBy },
    actor: parsed.data.updatedBy,
  });
  return Response.json({
    id: agenda.id,
    filename: agenda.filename,
    updatedBy: agenda.updatedBy,
    updatedAt: agenda.createdAt,
  });
}
