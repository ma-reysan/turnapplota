"use client";

import { Palette, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { shiftColorStyle } from "@/lib/shift-colors";
import type {
  Doctor,
  ScheduleMonth,
  ShiftAssignment,
  ShiftColorLegendItem,
  ShiftMarker,
} from "@/lib/types";
import { calendarDays, cn, monthKey, monthLabel } from "@/lib/utils";

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function ShiftChip({
  assignment,
  marker,
  doctorsById,
  highlightedDoctor,
  onToggleHighlight,
}: {
  assignment?: ShiftAssignment;
  marker?: ShiftMarker;
  doctorsById: Map<string, Doctor>;
  highlightedDoctor: string | null;
  onToggleHighlight: (doctorId: string) => void;
}) {
  const doctor = assignment ? doctorsById.get(assignment.doctorId) : undefined;
  const dimmed = Boolean(highlightedDoctor && doctor?.id !== highlightedDoctor);

  return (
    <button
      aria-label={doctor ? `Destacar turnos de ${doctor.longName}` : "Turno sin asignar"}
      className={cn(
        "flex h-[18px] w-full items-center justify-center truncate rounded border bg-[var(--shift-normal)] px-1 text-center text-[9px] font-bold leading-none tracking-tight text-[var(--shift-normal-text)] transition sm:text-[10px]",
        assignment?.kind === "NIGHT"
          ? "border-[var(--night-border)]"
          : "border-[var(--day-border)]",
        dimmed && "opacity-55",
      )}
      disabled={!doctor}
      onClick={() => {
        if (doctor && window.matchMedia("(hover: none)").matches) onToggleHighlight(doctor.id);
      }}
      style={shiftColorStyle(marker?.colorKey)}
      type="button"
    >
      {doctor?.shortName ?? "—"}
    </button>
  );
}

export function ScheduleCalendar({
  doctors,
  schedules,
  shiftColorLegend,
}: {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  shiftColorLegend: ShiftColorLegendItem[];
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
  const assignmentsBySlot = useMemo(
    () =>
      new Map(
        schedules.flatMap((item) =>
          item.assignments.map((assignment) => [
            `${assignment.date}-${assignment.kind}-${assignment.slot}`,
            assignment,
          ] as const),
        ),
      ),
    [schedules],
  );
  const markersBySlot = useMemo(
    () =>
      new Map(
        schedules.flatMap((item) =>
          (item.markers ?? []).map((marker) => [
            `${marker.date}-${marker.kind}-${marker.slot}`,
            marker,
          ] as const),
        ),
      ),
    [schedules],
  );
  const usedColorKeys = useMemo(
    () => new Set(schedule?.markers?.map((marker) => marker.colorKey) ?? []),
    [schedule],
  );

  const visibleDoctors = useMemo(() => {
    const ids = new Set(schedule?.assignments.map((assignment) => assignment.doctorId));
    return doctors
      .filter((doctor) => ids.has(doctor.id))
      .sort((a, b) => a.longName.localeCompare(b.longName, "es-CL"));
  }, [doctors, schedule]);

  const toggleHighlightedDoctor = useCallback((doctorId: string) => {
    setHighlightedDoctor((current) => current === doctorId ? null : doctorId);
  }, []);

  const makeImage = useCallback(async () => {
    if (!exportRef.current) return null;
    const { toBlob } = await import("html-to-image");
    return toBlob(exportRef.current, {
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--surface"),
      pixelRatio: 2,
    });
  }, []);

  const exportImage = useCallback(async () => {
    if (!schedule) return;
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
  }, [makeImage, schedule]);

  const exportPdf = useCallback(async () => {
    if (!schedule) return;
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
  }, [makeImage, schedule]);

  useEffect(() => {
    const onImage = () => void exportImage();
    const onPdf = () => void exportPdf();
    window.addEventListener("turnapp:export-image", onImage);
    window.addEventListener("turnapp:export-pdf", onPdf);
    return () => {
      window.removeEventListener("turnapp:export-image", onImage);
      window.removeEventListener("turnapp:export-pdf", onPdf);
    };
  }, [exportImage, exportPdf]);

  if (!schedule) {
    return <div className="rounded-2xl bg-[var(--surface)] p-5">No hay meses publicados.</div>;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(680px,70%)_220px]">
      <section className="min-w-0">
        <div className="no-print mb-2 flex items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Mes</span>
            <select
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs font-medium capitalize outline-none focus:ring-2 focus:ring-[var(--brand)]"
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
        </div>

        <div className="scrollbar-subtle overflow-x-auto rounded-2xl">
          <div
            className="min-w-[680px] border border-[var(--line)] bg-[var(--surface)] p-3"
            ref={exportRef}
          >
            <div className="mb-2 flex items-end justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
                  Urgencia · Lota
                </span>
                <h2 className="text-lg font-semibold capitalize">
                  {monthLabel(schedule.year, schedule.month)}
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekdayLabels.map((label) => (
                <div
                  className="pb-1 text-center text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]"
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
                      "min-h-[105px] rounded-lg border border-[var(--line)] p-1",
                      inMonth ? "bg-[var(--surface-soft)]" : "bg-transparent opacity-25",
                    )}
                    key={dateKey}
                  >
                    <span className="block text-right text-[9px] font-semibold leading-3 text-[var(--muted)]">
                      {date.getDate()}
                    </span>
                    <div className="space-y-0.5">
                      {[1, 2, 3].map((slot) => (
                        <ShiftChip
                          assignment={assignmentsBySlot.get(`${dateKey}-DAY-${slot}`)}
                          doctorsById={doctorsById}
                          highlightedDoctor={highlightedDoctor}
                          key={`day-${slot}`}
                          marker={markersBySlot.get(`${dateKey}-DAY-${slot}`)}
                          onToggleHighlight={toggleHighlightedDoctor}
                        />
                      ))}
                      <div aria-hidden className="mx-1 my-1 h-px bg-[var(--shift-divider)]" />
                      {[1, 2].map((slot) => (
                        <ShiftChip
                          assignment={assignmentsBySlot.get(`${dateKey}-NIGHT-${slot}`)}
                          doctorsById={doctorsById}
                          highlightedDoctor={highlightedDoctor}
                          key={`night-${slot}`}
                          marker={markersBySlot.get(`${dateKey}-NIGHT-${slot}`)}
                          onToggleHighlight={toggleHighlightedDoctor}
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

      <aside className="no-print self-start rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="flex items-center gap-2">
          <UsersRound size={15} className="text-[var(--brand)]" />
          <h3 className="text-sm font-semibold">Equipo del mes</h3>
        </div>
        <p className="mt-0.5 text-[10px] text-[var(--muted)]">Pasa o toca un nombre para destacarlo.</p>
        <div className="mt-2 grid gap-0.5 sm:grid-cols-2 xl:grid-cols-1">
          {visibleDoctors.map((doctor) => (
            <button
              className={cn(
                "rounded-lg px-2 py-1 text-left text-xs transition",
                highlightedDoctor === doctor.id
                  ? "bg-[var(--brand)] text-white"
                  : highlightedDoctor
                    ? "opacity-[.32]"
                    : "hover:bg-[var(--surface-soft)]",
              )}
              key={doctor.id}
              onClick={() => {
                if (window.matchMedia("(hover: none)").matches) toggleHighlightedDoctor(doctor.id);
              }}
              onMouseEnter={() => setHighlightedDoctor(doctor.id)}
              onMouseLeave={() => setHighlightedDoctor(null)}
              type="button"
            >
              <span className="flex items-center justify-between gap-1">
                <span className="truncate font-medium">{doctor.longName}</span>
                <span className="shrink-0 text-[8px] opacity-70">{doctor.shortName}</span>
              </span>
            </button>
          ))}
        </div>
        {usedColorKeys.size ? (
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-2.5">
            <div className="flex items-center gap-1.5">
              <Palette size={13} className="text-[var(--brand)]" />
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Colores
              </h4>
            </div>
            <div className="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-1">
              {shiftColorLegend
                .filter((item) => usedColorKeys.has(item.key))
                .map((item) => (
                  <div className="flex items-center gap-2 text-[10px]" key={item.key}>
                    <i
                      className="h-3 w-3 shrink-0 rounded-full border border-black/15"
                      style={shiftColorStyle(item.key)}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
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
