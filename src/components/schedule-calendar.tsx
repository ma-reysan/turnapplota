"use client";

import { ChevronLeft, ChevronRight, Palette, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ScheduleConflictNotice } from "@/components/schedule-conflict-notice";
import { findNightToDayConflicts, incompatibleAssignmentIds } from "@/lib/schedule-conflicts";
import { shiftColorStyle } from "@/lib/shift-colors";
import type {
  Doctor,
  ScheduleMonth,
  ShiftAssignment,
  ShiftColorLegendItem,
  ShiftMarker,
} from "@/lib/types";
import { calendarDays, cn, monthKey, monthLabel } from "@/lib/utils";
import { appliesOnCall, weekStart } from "@/lib/november-system";
import type { OnCallWeek } from "@/lib/november-system";

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function ShiftChip({
  assignment,
  marker,
  doctorsById,
  highlightedDoctor,
  incompatible,
  onToggleHighlight,
}: {
  assignment?: ShiftAssignment;
  marker?: ShiftMarker;
  doctorsById: Map<string, Doctor>;
  highlightedDoctor: string | null;
  incompatible: boolean;
  onToggleHighlight: (doctorId: string) => void;
}) {
  const doctor = assignment ? doctorsById.get(assignment.doctorId) : undefined;
  const dimmed = Boolean(highlightedDoctor && doctor?.id !== highlightedDoctor);

  return (
    <button
      aria-label={doctor ? `Destacar turnos de ${doctor.longName}` : "Turno sin asignar"}
      className={cn(
        "flex h-5 w-full items-center justify-center truncate rounded border border-[var(--shift-border)] bg-[var(--shift-normal)] px-1 text-center text-[10px] font-bold leading-none tracking-tight text-[var(--shift-normal-text)] transition sm:text-[11px]",
        dimmed && "opacity-[.32]",
        incompatible && "border-amber-500 ring-1 ring-amber-500",
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
  shiftColorLegends,
  onCallWeeks = [],
}: {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  shiftColorLegend: ShiftColorLegendItem[];
  shiftColorLegends?: Record<string, ShiftColorLegendItem[]>;
  onCallWeeks?: OnCallWeek[];
}) {
  const sortedSchedules = useMemo(
    () => [...schedules].sort((a, b) => b.id.localeCompare(a.id)),
    [schedules],
  );
  const [selectedId, setSelectedId] = useState(sortedSchedules[0]?.id ?? "");
  const [highlightedDoctor, setHighlightedDoctor] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const schedule = sortedSchedules.find((item) => item.id === selectedId) ?? sortedSchedules[0];
  const selectedIndex = sortedSchedules.findIndex((item) => item.id === schedule?.id);
  const currentColorLegend = shiftColorLegends?.[selectedId] ?? shiftColorLegend;
  const showOnCall = schedule?.id >= "2026-11";
  const onCallByWeek = new Map(onCallWeeks.map((item) => [item.weekStart, item]));
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
    () => {
      const keys = new Set(schedule?.markers?.map((marker) => marker.colorKey) ?? []);
      if (schedule && showOnCall) {
        const visibleWeeks = new Set(calendarDays(schedule.year, schedule.month).map((date) =>
          weekStart(`${monthKey(date.getFullYear(), date.getMonth() + 1)}-${String(date.getDate()).padStart(2, "0")}`)));
        for (const week of onCallWeeks) {
          if (!visibleWeeks.has(week.weekStart)) continue;
          for (const colorKey of week.colorKeys) if (colorKey) keys.add(colorKey);
        }
      }
      return keys;
    },
    [schedule, showOnCall, onCallWeeks],
  );
  const conflicts = useMemo(
    () => findNightToDayConflicts(schedules.flatMap((item) => item.assignments)),
    [schedules],
  );
  const conflictAssignmentIds = useMemo(
    () => incompatibleAssignmentIds(schedules.flatMap((item) => item.assignments), conflicts),
    [conflicts, schedules],
  );
  const visibleDateKeys = useMemo(
    () => new Set(calendarDays(schedule.year, schedule.month).map((date) =>
      `${monthKey(date.getFullYear(), date.getMonth() + 1)}-${String(date.getDate()).padStart(2, "0")}`,
    )),
    [schedule.month, schedule.year],
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
        <div className="halloween-month-bar no-print mb-2 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
          <div aria-hidden="true" className="halloween-month-spiders" />
          <span className="text-sm text-[var(--muted)]">Mes</span>
          <button
            aria-label="Mes anterior"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-1.5 transition hover:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={selectedIndex >= sortedSchedules.length - 1}
            onClick={() => setSelectedId(sortedSchedules[selectedIndex + 1].id)}
            title="Mes anterior"
            type="button"
          >
            <ChevronLeft size={16} />
          </button>
          <select
            aria-label="Mes"
            className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs font-medium capitalize outline-none focus:ring-2 focus:ring-[var(--brand)]"
            onChange={(event) => setSelectedId(event.target.value)}
            value={schedule.id}
          >
            {sortedSchedules.map((item) => (
              <option key={item.id} value={item.id}>
                {monthLabel(item.year, item.month)}
              </option>
            ))}
          </select>
          <button
            aria-label="Mes siguiente"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-1.5 transition hover:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={selectedIndex <= 0}
            onClick={() => setSelectedId(sortedSchedules[selectedIndex - 1].id)}
            title="Mes siguiente"
            type="button"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <ScheduleConflictNotice conflicts={conflicts} doctors={doctors} visibleDates={visibleDateKeys} />

        <div className="scrollbar-subtle overflow-x-auto rounded-2xl">
          <div
            className={cn("border border-[var(--line)] bg-[var(--surface)] p-3", showOnCall ? "min-w-[900px]" : "min-w-[680px]")}
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
            <div className={cn("grid gap-1", showOnCall ? "grid-cols-8" : "grid-cols-7")}>
              {weekdayLabels.map((label) => (
                <div
                  className="pb-1 text-center text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]"
                  key={label}
                >
                  {label}
                </div>
              ))}
              {showOnCall ? <div className="pb-1 text-center text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">Llamado</div> : null}
              {calendarDays(schedule.year, schedule.month).map((date, index) => {
                const dateKey = monthKey(
                  date.getFullYear(),
                  date.getMonth() + 1,
                ) + `-${String(date.getDate()).padStart(2, "0")}`;
                const inMonth = date.getMonth() + 1 === schedule.month;
                const start = weekStart(dateKey);
                const week = onCallByWeek.get(start);
                return (
                  <div className="contents" key={dateKey}>
                  <div
                    className={cn(
                      "min-h-[105px] rounded-lg border border-[var(--line)] p-1",
                      inMonth ? "bg-[var(--surface-soft)]" : "bg-[var(--surface-soft)] opacity-55",
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
                          incompatible={conflictAssignmentIds.has(assignmentsBySlot.get(`${dateKey}-DAY-${slot}`)?.id ?? "")}
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
                          incompatible={conflictAssignmentIds.has(assignmentsBySlot.get(`${dateKey}-NIGHT-${slot}`)?.id ?? "")}
                          key={`night-${slot}`}
                          marker={markersBySlot.get(`${dateKey}-NIGHT-${slot}`)}
                          onToggleHighlight={toggleHighlightedDoctor}
                        />
                      ))}
                    </div>
                  </div>
                  {showOnCall && index % 7 === 6 ? (
                    <div className="flex min-h-[105px] flex-col justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-1">
                      <span className="text-center text-[9px] text-[var(--muted)]">
                        {appliesOnCall(start) ? `Semana ${start.slice(8)}` : "Desde 1 nov"}
                      </span>
                      {[0, 1, 2].map((slot) => {
                        const doctorId = week?.doctorIds[slot] ?? "";
                        return <span className="truncate rounded border border-[var(--shift-border)] bg-[var(--shift-normal)] px-1 text-center text-[10px] font-semibold text-[var(--shift-normal-text)]"
                          key={slot} style={shiftColorStyle(week?.colorKeys[slot] ?? undefined)}>
                          {doctorsById.get(doctorId)?.shortName ?? "—"}
                        </span>;
                      })}
                    </div>
                  ) : null}
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
              {currentColorLegend
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
