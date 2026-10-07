import { del, get, put } from "@vercel/blob";
import { desc, isNull } from "drizzle-orm";
import { getDb, getSql, isDatabaseConfigured } from "@/db";
import { apsAgendas } from "@/db/schema";
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

  const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const uploaded = await put(`agenda-aps/${crypto.randomUUID()}-${safeName}`, uploadFile, {
    access: "private",
    addRandomSuffix: false,
    contentType: uploadFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const sql = getSql();
  const agendaId = crypto.randomUUID();
  const updatedAt = new Date();
  let archivedRows: Record<string, unknown>[];
  try {
    const [, archived] = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(75482001)`,
      sql`UPDATE aps_agendas SET archived_at = ${updatedAt} WHERE archived_at IS NULL RETURNING blob_url`,
      sql`INSERT INTO aps_agendas (id, blob_url, blob_path, filename, content_type, updated_by, created_at)
        VALUES (${agendaId}, ${uploaded.url}, ${uploaded.pathname}, ${uploadFile.name}, ${uploaded.contentType}, ${parsed.data.updatedBy}, ${updatedAt})`,
      sql`INSERT INTO audit_events (action, entity_type, entity_id, after, actor)
        VALUES ('aps_agenda.replaced', 'aps_agenda', ${agendaId},
          ${JSON.stringify({ filename: uploadFile.name, updatedBy: parsed.data.updatedBy })}::jsonb, ${parsed.data.updatedBy})`,
    ]);
    archivedRows = archived as Record<string, unknown>[];
  } catch (error) {
    await del(uploaded.url).catch((cleanupError) => console.error("No se pudo limpiar la subida de Agenda APS", cleanupError));
    throw error;
  }
  await Promise.all(archivedRows.map((row) => del(String(row.blob_url)).catch((error) => {
    console.error("No se pudo retirar una Agenda APS reemplazada", error);
  })));
  return Response.json({
    id: agendaId,
    filename: uploadFile.name,
    updatedBy: parsed.data.updatedBy,
    updatedAt,
  });
}
