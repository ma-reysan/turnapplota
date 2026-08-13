import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AgendaActivity } from "@/lib/agenda-analyzer";

type Day = { label: string; date: string; activities: AgendaActivity[] };

function download(bytes: Uint8Array, doctorName: string) {
  const safe = doctorName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "medico";
  const stableBytes = bytes.slice().buffer as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([stableBytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `agenda-mensual-${safe}.pdf`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export async function exportAgendaPdf(doctorName: string, days: Day[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const chunks = days.length ? Array.from({ length: Math.ceil(days.length / 8) }, (_, index) => days.slice(index * 8, index * 8 + 8)) : [[]];
  chunks.forEach((chunk, pageIndex) => {
    const page = pdf.addPage([792, 612]);
    page.drawRectangle({ x: 0, y: 542, width: 792, height: 70, color: rgb(.12, .24, .54) });
    page.drawText("HOSPITAL DE LOTA · AGENDA MÉDICA", { x: 42, y: 585, size: 9, font: bold, color: rgb(.8, .87, 1) });
    page.drawText("Agenda mensual", { x: 42, y: 560, size: 19, font: bold, color: rgb(1, 1, 1) });
    page.drawText(doctorName, { x: 500, y: 561, size: 13, font: bold, color: rgb(1, 1, 1), maxWidth: 245 });
    chunk.forEach((day, index) => {
      const col = index % 2, row = Math.floor(index / 2), width = 347, height = 108;
      const x = 42 + col * 361, top = 523 - row * 117, y = top - height;
      page.drawRectangle({ x, y, width, height, color: rgb(.985, .99, 1), borderColor: rgb(.72, .8, .94), borderWidth: 1 });
      page.drawRectangle({ x, y: top - 23, width, height: 23, color: rgb(.91, .95, 1) });
      page.drawText(`${day.label} ${day.date ? `· ${day.date}` : ""}`.toUpperCase(), { x: x + 8, y: top - 15, size: 8, font: bold, color: rgb(.09, .25, .56) });
      let cursor = top - 37;
      (day.activities.length ? day.activities : [{ time: "", activity: "Libre / Sin actividades" }]).slice(0, 5).forEach((activity) => {
        const text = `${activity.time ? `${activity.time}  ` : ""}${activity.activity}`;
        page.drawText(text.slice(0, 72), { x: x + 9, y: cursor, size: 8.5, font: activity.activity.includes("TURNO") ? bold : regular, color: activity.activity.includes("TURNO NOCHE") ? rgb(.16, .22, .55) : rgb(.15, .2, .29) });
        cursor -= 14;
      });
    });
    page.drawText(`${pageIndex + 1} / ${chunks.length}`, { x: 720, y: 22, size: 8, font: regular, color: rgb(.42, .46, .55) });
  });
  download(await pdf.save(), doctorName);
}
