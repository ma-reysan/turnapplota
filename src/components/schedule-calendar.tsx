"use client";

import { Download, FileImage, FileText } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Doctor, ScheduleMonth, ShiftAssignment } from "@/lib/types";
import { calendarDays, cn, monthKey, monthLabel } from "@/lib/utils";

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function ShiftChip({
  assignment,
  doctorsById,
  highlightedDoctor,
  onHighlight,
}: {
  assignment?: ShiftAssignment;
  doctorsById: Map<string, Doctor>;
  highlightedDoctor: string | null;
  onHighlight: (doctorId: string | null) => void;
}) {
  const doctor = assignment ? doctorsById.get(assignment.doctorId) : undefined;
  const dimmed = Boolean(highlightedDoctor && doctor?.id !== highlightedDoctor);

  return (
    <button
      aria-label={doctor ? `Destacar turnos de ${doctor.longName}` : "Turno sin asignar"}
      className={cn(
        "min-h-6 w-full truncate rounded-md border px-1.5 py-0.5 text-center text-[9px] font-bold tracking-tight transition sm:text-[10px]",
        assignment?.kind === "NIGHT"
          ? "border-[var(--night-border)] bg-[var(--night)]"
          : "border-[var(--day-border)] bg-[var(--day)]",
        dimmed && "opacity-20",
      )}
      disabled={!doctor}
      onBlur={() => onHighlight(null)}
      onFocus={() => doctor && onHighlight(doctor.id)}
      onMouseEnter={() => doctor && onHighlight(doctor.id)}
      onMouseLeave={() => onHighlight(null)}
      type="button"
    >
      {doctor?.shortName ?? "—"}
    </button>
  );
}

export function ScheduleCalendar({
  doctors,
  schedules,
}: {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
}) {
  const sortedSchedules = useMemo(
    () => [...schedules].sort((a, b) => b.id.localeCompare(a.id)),
    [schedules],
  );
  const [selectedId, setSelectedId] = useState(sortedSchedules[0]?.id ?? "");
  const [highlightedDoctor, setHighlightedDoctor] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const schedule = sortedSchedules.find((item) => item.id === selectedId) ?? sortedSchedules[0];
  const doctorsById = useMemo(
    () => new Map(doctors.map((doctor) => [doctor.id, doctor])),
    [doctors],
  );

  const visibleDoctors = useMemo(() => {
    const ids = new Set(schedule?.assignments.map((assignment) => assignment.doctorId));
    return doctors
      .filter((doctor) => ids.has(doctor.id))
      .sort((a, b) => a.longName.localeCompare(b.longName, "es-CL"));
  }, [doctors, schedule]);

  if (!schedule) {
    return <div className="rounded-3xl bg-[var(--surface)] p-8">No hay meses publicados.</div>;
  }

  const assignmentsBySlot = new Map(
    schedule.assignments.map((assignment) => [
      `${assignment.date}-${assignment.kind}-${assignment.slot}`,
      assignment,
    ]),
  );

  async function makeImage() {
    if (!exportRef.current) return null;
    const { toBlob } = await import("html-to-image");
    return toBlob(exportRef.current, {
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--surface"),
      pixelRatio: 2,
    });
  }

  async function exportImage() {
    const blob = await makeImage();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Calendario copiado al portapapeles");
    } catch {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `turnos-${schedule.id}.png`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Imagen descargada");
    }
  }

  async function exportPdf() {
    const blob = await makeImage();
    if (!blob) return;
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const properties = pdf.getImageProperties(dataUrl);
    const ratio = Math.min(277 / properties.width, 190 / properties.height);
    const width = properties.width * ratio;
    const height = properties.height * ratio;
    pdf.addImage(dataUrl, "PNG", (297 - width) / 2, (210 - height) / 2, width, height);
    const bytes = pdf.output("arraybuffer");
    const file = new Blob([bytes], { type: "application/pdf" });
    const suggestedName = `turnos-${schedule.id}.pdf`;

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(file);
        await writable.close();
        toast.success("PDF guardado");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    pdf.save(suggestedName);
    toast.success("PDF descargado");
  }

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(760px,1fr)_280px]">
      <section className="min-w-0">
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Mes</span>
            <select
              className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 font-medium capitalize outline-none focus:ring-2 focus:ring-[var(--brand)]"
              onChange={(event) => setSelectedId(event.target.value)}
              value={schedule.id}
            >
              {sortedSchedules.map((item) => (
                <option key={item.id} value={item.id}>
                  {monthLabel(item.year, item.month)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-soft)]"
              onClick={exportImage}
              type="button"
            >
              <FileImage size={16} /> Imagen
            </button>
            <button
              className="flex items-center gap-2 rounded-xl bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white"
              onClick={exportPdf}
              type="button"
            >
              <FileText size={16} /> PDF
            </button>
          </div>
        </div>

        <div className="scrollbar-subtle overflow-x-auto rounded-3xl">
          <div
            className="min-w-[760px] border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6"
            ref={exportRef}
          >
            <div className="mb-4 flex items-end justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
                  Urgencia · Lota
                </span>
                <h2 className="mt-1 text-2xl font-semibold capitalize">
                  {monthLabel(schedule.year, schedule.month)}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <i className="h-3 w-3 rounded border border-[var(--day-border)] bg-[var(--day)]" />
                  Día
                </span>
                <span className="flex items-center gap-1">
                  <i className="h-3 w-3 rounded border border-[var(--night-border)] bg-[var(--night)]" />
                  Noche
                </span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {weekdayLabels.map((label) => (
                <div
                  className="pb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]"
                  key={label}
                >
                  {label}
                </div>
              ))}
              {calendarDays(schedule.year, schedule.month).map((date) => {
                const dateKey = monthKey(
                  date.getFullYear(),
                  date.getMonth() + 1,
                ) + `-${String(date.getDate()).padStart(2, "0")}`;
                const inMonth = date.getMonth() + 1 === schedule.month;
                return (
                  <div
                    className={cn(
                      "min-h-[132px] rounded-xl border border-[var(--line)] p-1.5",
                      inMonth ? "bg-[var(--surface-soft)]" : "bg-transparent opacity-25",
                    )}
                    key={dateKey}
                  >
                    <span className="mb-1 block text-right text-[10px] font-semibold text-[var(--muted)]">
                      {date.getDate()}
                    </span>
                    <div className="space-y-1">
                      {[1, 2, 3].map((slot) => (
                        <ShiftChip
                          assignment={assignmentsBySlot.get(`${dateKey}-DAY-${slot}`)}
                          doctorsById={doctorsById}
                          highlightedDoctor={highlightedDoctor}
                          key={`day-${slot}`}
                          onHighlight={setHighlightedDoctor}
                        />
                      ))}
                      {[1, 2].map((slot) => (
                        <ShiftChip
                          assignment={assignmentsBySlot.get(`${dateKey}-NIGHT-${slot}`)}
                          doctorsById={doctorsById}
                          highlightedDoctor={highlightedDoctor}
                          key={`night-${slot}`}
                          onHighlight={setHighlightedDoctor}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <aside className="no-print rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-2">
          <Download size={17} className="text-[var(--brand)]" />
          <h3 className="font-semibold">Equipo del mes</h3>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">Pasa sobre un nombre para destacarlo.</p>
        <div className="mt-4 grid gap-1.5 sm:grid-cols-2 2xl:grid-cols-1">
          {visibleDoctors.map((doctor) => (
            <button
              className={cn(
                "rounded-xl px-3 py-2 text-left text-sm transition",
                highlightedDoctor === doctor.id
                  ? "bg-[var(--brand)] text-white"
                  : highlightedDoctor
                    ? "opacity-30"
                    : "hover:bg-[var(--surface-soft)]",
              )}
              key={doctor.id}
              onBlur={() => setHighlightedDoctor(null)}
              onFocus={() => setHighlightedDoctor(doctor.id)}
              onMouseEnter={() => setHighlightedDoctor(doctor.id)}
              onMouseLeave={() => setHighlightedDoctor(null)}
              type="button"
            >
              <span className="block font-medium">{doctor.longName}</span>
              <span className="text-[10px] opacity-70">{doctor.shortName}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

declare global {
  interface Window {
    showSaveFilePicker: (options: {
      suggestedName: string;
      types: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (blob: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  }
}
