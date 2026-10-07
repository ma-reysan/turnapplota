import { desc } from "drizzle-orm";
import { connection } from "next/server";
import { getDb, isDatabaseConfigured } from "@/db";
import { lunchMenus } from "@/db/schema";
import type { LunchMenu } from "@/lib/types";

export const LUNCH_MENU_SOURCE_URL = "https://sites.google.com/view/centralalimentacinhospitallota/inicio";

const MONTHS: Record<string, string> = {
  ENERO: "01", FEBRERO: "02", MARZO: "03", ABRIL: "04", MAYO: "05", JUNIO: "06",
  JULIO: "07", AGOSTO: "08", SEPTIEMBRE: "09", OCTUBRE: "10", NOVIEMBRE: "11", DICIEMBRE: "12",
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '\"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, entity: string) => {
      const code = entity.toLowerCase().startsWith("x") ? Number.parseInt(entity.slice(1), 16) : Number.parseInt(entity, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    });
}

function textFromHtml(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function textBlocks(value: string) {
  return Array.from(value.matchAll(/<(?:p|h[1-6])\b[^>]*>([\s\S]*?)<\/(?:p|h[1-6])>/gi))
    .map((match) => textFromHtml(match[1]))
    .filter(Boolean);
}

export function parseLunchMenuHtml(html: string) {
  const heading = /<h1\b[^>]*>[\s\S]*?men[úu]\s+del\s+d[ií]a[\s\S]*?<\/h1>/i.exec(html);
  if (!heading || heading.index === undefined) throw new Error("No se encontró el bloque ‘Menú del día’ en la fuente");

  const before = textBlocks(html.slice(0, heading.index)).slice(-20).join(" ");
  const dates = Array.from(before.matchAll(/(?:LUNES|MARTES|MI[ÉE]RCOLES|JUEVES|VIERNES|S[ÁA]BADO|DOMINGO)?\s*(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚ]+)\s+DE\s+(20\s*\d\s*\d)/gi));
  const date = dates.at(-1);
  if (!date) throw new Error("No se encontró la fecha del menú en la fuente");
  const month = MONTHS[date[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
  if (!month) throw new Error("El mes publicado no es válido");

  const afterHeading = html.slice(heading.index + heading[0].length);
  const sectionEnd = afterHeading.search(/<\/section>/i);
  const content = textBlocks(sectionEnd >= 0 ? afterHeading.slice(0, sectionEnd) : afterHeading).join("\n");
  if (!content) throw new Error("El menú publicado no contiene preparaciones");

  return {
    menuDate: date[3].replace(/\s/g, "") + "-" + month + "-" + date[1].padStart(2, "0"),
    content,
  };
}

function mapRow(row: typeof lunchMenus.$inferSelect): LunchMenu {
  return {
    id: row.id,
    menuDate: row.menuDate,
    content: row.content,
    sourceUrl: row.sourceUrl,
    fetchedAt: row.fetchedAt.toISOString(),
  };
}

export async function getLatestLunchMenu() {
  if (!isDatabaseConfigured()) return null;
  await connection();
  const [row] = await getDb().select().from(lunchMenus).orderBy(desc(lunchMenus.menuDate), desc(lunchMenus.fetchedAt)).limit(1);
  return row ? mapRow(row) : null;
}

export async function syncLunchMenu() {
  if (!isDatabaseConfigured()) throw new Error("Base de datos no configurada");
  const response = await fetch(LUNCH_MENU_SOURCE_URL, {
    cache: "no-store",
    headers: { "User-Agent": "TurnApp Lota/1.0 (+https://turnapplota.vercel.app)" },
  });
  if (!response.ok) throw new Error("La fuente respondió " + response.status);
  const parsed = parseLunchMenuHtml(await response.text());
  const [row] = await getDb()
    .insert(lunchMenus)
    .values({ ...parsed, sourceUrl: LUNCH_MENU_SOURCE_URL, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: lunchMenus.menuDate,
      set: { content: parsed.content, sourceUrl: LUNCH_MENU_SOURCE_URL, fetchedAt: new Date() },
    })
    .returning();
  return mapRow(row);
}
