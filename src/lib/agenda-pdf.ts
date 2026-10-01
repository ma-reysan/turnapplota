import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { AgendaActivity } from "@/lib/agenda-analyzer";

type Day = { label: string; date: string; activities: AgendaActivity[] };
type Line = { text: string; bold: boolean };
type Card = { day: Day; lines: Line[]; height: number };

const GREEN = rgb(29 / 255, 107 / 255, 98 / 255);
const DEEP_GREEN = rgb(22 / 255, 77 / 255, 71 / 255);
const PALE_GREEN = rgb(232 / 255, 239 / 255, 237 / 255);
const BORDER_GREEN = rgb(185 / 255, 203 / 255, 198 / 255);
const TEXT = rgb(25 / 255, 39 / 255, 37 / 255);
const COLUMNS = 3;
const CARD_WIDTH = 237;
const CARD_GAP = 8;
const ROW_GAP = 5;
const TOP = 530;
const BOTTOM = 31;

function download(bytes: Uint8Array, doctorName: string, fileSuffix?: string) {
  const safe = doctorName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "medico";
  const stableBytes = bytes.slice().buffer as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([stableBytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `agenda-${fileSuffix ? `${fileSuffix}-` : "mensual-"}${safe}.pdf`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    while (font.widthOfTextAtSize(line, size) > maxWidth) {
      let end = 1;
      while (end < line.length && font.widthOfTextAtSize(line.slice(0, end + 1), size) <= maxWidth) end += 1;
      lines.push(line.slice(0, end));
      line = line.slice(end);
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function exportAgendaPdf(doctorName: string, days: Day[], options?: { periodLabel?: string; fileSuffix?: string; includeAllActivities?: boolean }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 7.4;
  const cards: Card[] = days.map((day) => {
    const activities = day.activities.length ? day.activities : [{ time: "", activity: "Libre / Sin actividades" }];
    const shown = options?.includeAllActivities ? activities : activities.slice(0, 5);
    const lines = shown.flatMap((activity) => {
      const isShift = activity.activity.includes("TURNO");
      const font = isShift ? bold : regular;
      const value = `${activity.time ? `${activity.time}  ` : ""}${activity.activity}`;
      return wrap(value, font, fontSize, CARD_WIDTH - 14).map((text) => ({ text, bold: isShift }));
    });
    return { day, lines, height: Math.max(34, 32 + (lines.length - 1) * 7.5) };
  });
  const rows = Array.from({ length: Math.ceil(cards.length / COLUMNS) }, (_, index) => cards.slice(index * COLUMNS, (index + 1) * COLUMNS));
  const pages: Array<Array<{ cards: Card[]; height: number }>> = [[]];
  let used = 0;
  rows.forEach((row) => {
    const height = Math.max(...row.map((card) => card.height));
    const gap = pages.at(-1)!.length ? ROW_GAP : 0;
    if (pages.at(-1)!.length >= 6 || used + gap + height > TOP - BOTTOM) {
      pages.push([]);
      used = 0;
    }
    const pageRows = pages.at(-1)!;
    used += (pageRows.length ? ROW_GAP : 0) + height;
    pageRows.push({ cards: row, height });
  });

  pages.forEach((pageRows, pageIndex) => {
    const page = pdf.addPage([792, 612]);
    page.drawRectangle({ x: 0, y: 548, width: 792, height: 64, color: GREEN });
    page.drawText("HOSPITAL DE LOTA · AGENDA MÉDICA", { x: 32, y: 586, size: 9, font: bold, color: PALE_GREEN });
    page.drawText(options?.periodLabel ? `Agenda APS · ${options.periodLabel}` : "Agenda mensual", { x: 32, y: 562, size: options?.periodLabel ? 16 : 18, font: bold, color: rgb(1, 1, 1), maxWidth: 430 });
    page.drawText(doctorName, { x: 525, y: 564, size: 11, font: bold, color: rgb(1, 1, 1), maxWidth: 235 });
    let top = TOP;
    pageRows.forEach(({ cards: row, height }) => {
      row.forEach(({ day, lines }, column) => {
        const x = 32 + column * (CARD_WIDTH + CARD_GAP);
        const y = top - height;
        page.drawRectangle({ x, y, width: CARD_WIDTH, height, color: rgb(1, 1, 1), borderColor: BORDER_GREEN, borderWidth: .7 });
        page.drawRectangle({ x, y: top - 16, width: CARD_WIDTH, height: 16, color: PALE_GREEN });
        page.drawText(`${day.label} ${day.date ? `· ${day.date}` : ""}`.toUpperCase(), { x: x + 6, y: top - 11, size: 7.5, font: bold, color: DEEP_GREEN, maxWidth: CARD_WIDTH - 12 });
        lines.forEach((line, index) => {
          page.drawText(line.text, { x: x + 7, y: top - 26 - index * 7.5, size: fontSize, font: line.bold ? bold : regular, color: TEXT });
        });
      });
      top -= height + ROW_GAP;
    });
    page.drawText(`${pageIndex + 1} / ${pages.length}`, { x: 735, y: 17, size: 8, font: regular, color: DEEP_GREEN });
  });
  download(await pdf.save(), doctorName, options?.fileSuffix);
}
