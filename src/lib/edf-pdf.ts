import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ShiftAssignment } from "@/lib/types";
import { monthLabel } from "@/lib/utils";

const WEEKDAYS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

function download(bytes: Uint8Array, filename: string) {
  const safeBytes = bytes.slice().buffer as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([safeBytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export async function exportDoctorShiftsPdf({
  doctorName,
  year,
  month,
  assignments,
}: {
  doctorName: string;
  year: number;
  month: number;
  assignments: ShiftAssignment[];
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const days = new Map<string, { day: string; shifts: string[] }>();
  assignments.forEach((assignment) => {
    const date = new Date(`${assignment.date}T12:00:00`);
    const key = assignment.date;
    const entry = days.get(key) ?? { day: `${WEEKDAYS[date.getDay()]} ${date.getDate()}`, shifts: [] };
    const type = assignment.kind === "NIGHT" ? "Noche" : "Día";
    entry.shifts.push(`${type} · puesto ${assignment.slot}`);
    days.set(key, entry);
  });
  const rows = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
  const rowsPerPage = 24;
  const chunks = Array.from({ length: Math.ceil(rows.length / rowsPerPage) }, (_, index) => rows.slice(index * rowsPerPage, (index + 1) * rowsPerPage));

  chunks.forEach((chunk, pageIndex) => {
    const page = pdf.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 754, width: 595, height: 88, color: rgb(.12, .24, .54) });
    page.drawText("HOSPITAL DE LOTA · EDF", { x: 42, y: 814, size: 9, font: bold, color: rgb(.8, .87, 1) });
    page.drawText("Agenda mensual de turnos", { x: 42, y: 785, size: 19, font: bold, color: rgb(1, 1, 1) });
    page.drawText(doctorName, { x: 365, y: 785, size: 12, font: bold, color: rgb(1, 1, 1), maxWidth: 188 });
    page.drawText(monthLabel(year, month).toLocaleUpperCase("es-CL"), { x: 42, y: 733, size: 11, font: bold, color: rgb(.12, .24, .54) });
    page.drawText("DÍA", { x: 52, y: 706, size: 8, font: bold, color: rgb(.35, .39, .46) });
    page.drawText("TURNOS", { x: 190, y: 706, size: 8, font: bold, color: rgb(.35, .39, .46) });
    let y = 683;
    chunk.forEach(([date, entry], index) => {
      if (index % 2 === 0) page.drawRectangle({ x: 42, y: y - 8, width: 511, height: 25, color: rgb(.95, .97, .99) });
      page.drawText(`${entry.day} · ${date.slice(8, 10)}/${date.slice(5, 7)}`, { x: 52, y, size: 9, font: bold, color: rgb(.15, .2, .29) });
      page.drawText(entry.shifts.join("     "), { x: 190, y, size: 9, font: regular, color: rgb(.15, .2, .29), maxWidth: 350 });
      y -= 25;
    });
    page.drawText(`${pageIndex + 1} / ${chunks.length}`, { x: 525, y: 22, size: 8, font: regular, color: rgb(.42, .46, .55) });
  });

  const slug = doctorName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "medico";
  download(await pdf.save(), `turnos-${year}-${String(month).padStart(2, "0")}-${slug}.pdf`);
}
