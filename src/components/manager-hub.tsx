"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { addDays } from "date-fns";
import {
  CalendarCheck,
  CalendarPlus,
  GripVertical,
  LoaderCircle,
  Paintbrush,
  Palette,
  Plus,
  Settings2,
  Save,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ReplacementStatus } from "@/components/replacement-status";
import { AbsenceFreezeManager } from "@/components/absence-freeze-manager";
import type { NovemberData } from "@/lib/november-data";
import { availableFichas, basePointRecords, NEW_SYSTEM_START, santiagoParts, weekStart } from "@/lib/november-system";
import type { OnCallWeek } from "@/lib/november-system";
import { ScheduleConflictNotice } from "@/components/schedule-conflict-notice";
import { OtrosManager } from "@/components/otros-manager";
import { buildScheduleManagerAnalysis } from "@/lib/analysis";
import {
  getAutomaticReplacementType,
  getReplacementTypeLabel,
  type ReplacementShift,
} from "@/lib/replacement-scoring";
import { SHIFT_COLOR_KEYS, shiftColorStyle } from "@/lib/shift-colors";
import { findNightToDayConflicts, incompatibleAssignmentIds } from "@/lib/schedule-conflicts";
import type {
  Doctor,
  Holiday,
  Replacement,
  ReplacementType,
  ScheduleMonth,
  ShiftAssignment,
  ShiftColorKey,
  ShiftColorLegendItem,
  ShiftKind,
  ShiftMarker,
} from "@/lib/types";
import {
  calendarDays,
  cn,
  monthKey,
  monthLabel,
  normalizeDoctorSearch,
} from "@/lib/utils";

function DoctorDragCard({
  doctor,
  highlightedDoctor,
  onHighlight,
  onToggleHighlight,
}: {
  doctor: Doctor;
  highlightedDoctor: string | null;
  onHighlight: (doctorId: string | null) => void;
  onToggleHighlight: (doctorId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `doctor:${doctor.id}`,
  });
  return (
    <button
      className={cn(
        "flex w-full items-center gap-1.5 rounded-lg border border-[var(--line)] px-2 py-1.5 text-left transition",
        highlightedDoctor === doctor.id
          ? "border-[var(--brand)] bg-[var(--brand)] text-white"
          : highlightedDoctor
            ? "opacity-[.32]"
            : "bg-[var(--surface)] hover:bg-[var(--surface-soft)]",
        isDragging && "opacity-40",
      )}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      type="button"
      onClick={() => {
        if (window.matchMedia("(hover: none)").matches) onToggleHighlight(doctor.id);
      }}
      onMouseEnter={() => onHighlight(doctor.id)}
      onMouseLeave={() => onHighlight(null)}
      {...listeners}
      {...attributes}
    >
      <GripVertical size={15} className="text-[var(--muted)]" />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-1">
        <strong className="truncate text-[10px]">{doctor.longName}</strong>
        <small className="shrink-0 text-[8px] text-[var(--muted)]">{doctor.shortName}</small>
      </span>
    </button>
  );
}

function EditableShiftCard({
  date,
  kind,
  slot,
  assignment,
  marker,
  doctors,
  colorLegend,
  laneHighlighted,
  hasIncompatibility,
  highlightedDoctor,
  editable = true,
  onAssign,
  onColor,
}: {
  date: string;
  kind: ShiftKind;
  slot: number;
  assignment?: ShiftAssignment;
  marker?: ShiftMarker;
  doctors: Doctor[];
  colorLegend: ShiftColorLegendItem[];
  laneHighlighted: boolean;
  hasIncompatibility: boolean;
  highlightedDoctor: string | null;
  editable?: boolean;
  onAssign: (doctorId: string | null) => void;
  onColor: (colorKey: ShiftColorKey | null) => void;
}) {
  const dropId = `slot:${date}:${kind}:${slot}`;
  const { isOver, setNodeRef } = useDroppable({ id: dropId });
  const assignedDoctor = doctors.find((doctor) => doctor.id === assignment?.doctorId);
  const dimmed = Boolean(highlightedDoctor && assignedDoctor?.id !== highlightedDoctor);
  const [query, setQuery] = useState(assignedDoctor?.shortName ?? "");
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const normalized = normalizeDoctorSearch(query);
  const suggestions = doctors
    .filter((doctor) => doctor.active)
    .filter((doctor) => {
      if (normalized.length < 2) return false;
      return (
        normalizeDoctorSearch(doctor.shortName).includes(normalized) ||
        normalizeDoctorSearch(doctor.longName).includes(normalized)
      );
    })
    .slice(0, 6);

  function choose(doctor: Doctor) {
    setQuery(doctor.shortName);
    setOpen(false);
    onAssign(doctor.id);
  }

  function validate() {
    if (!query.trim()) {
      onAssign(null);
      setOpen(false);
      return;
    }
    const exact = doctors.find(
      (doctor) =>
        doctor.active &&
        [doctor.shortName, doctor.longName].some(
          (name) => normalizeDoctorSearch(name) === normalizeDoctorSearch(query),
        ),
    );
    if (exact) choose(exact);
    else {
      setQuery(assignedDoctor?.shortName ?? "");
      setOpen(false);
      toast.error("Médico no encontrado. Agrégalo primero a la nómina.");
    }
  }

  return (
    <div className="group/shift relative" ref={setNodeRef}>
      <input
        aria-label={`${kind === "DAY" ? "Turno día" : "Turno noche"} ${slot}`}
        className={cn(
          "relative z-30 block h-[18px] w-full rounded border border-[var(--shift-border)] bg-[var(--shift-normal)] py-0 pl-5 pr-5 text-center text-[9px] font-bold uppercase leading-[16px] text-[var(--shift-normal-text)] outline-none transition-[border-color,box-shadow,opacity] duration-150 focus:ring-2 focus:ring-[var(--brand)] sm:text-[10px]",
          hasIncompatibility && "border-amber-500 ring-1 ring-amber-500",
          isOver && !laneHighlighted && "border-[var(--brand)] ring-2 ring-[var(--brand)]",
          laneHighlighted && "border-purple-500 ring-2 ring-purple-500",
          dimmed && "opacity-[.32]",
        )}
        disabled={!editable}
        onBlur={() => window.setTimeout(validate, 120)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (suggestions[0]) choose(suggestions[0]);
            else validate();
          }
          if (event.key === "Escape") {
            setQuery(assignedDoctor?.shortName ?? "");
            setOpen(false);
          }
        }}
        placeholder="-"
        style={shiftColorStyle(marker?.colorKey)}
        value={query}
      />
      {editable ? <button
        aria-expanded={paletteOpen}
        aria-label="Pintar turno"
        className={cn(
          "absolute left-0 top-0 z-40 grid h-[18px] w-4 place-items-center rounded-l text-white opacity-0 drop-shadow-[0_1px_1px_rgba(0,0,0,.9)] transition-opacity hover:bg-black/15 focus:opacity-100 group-hover/shift:opacity-100 group-focus-within/shift:opacity-100 [@media(hover:none)]:opacity-60",
          !marker && "text-[var(--shift-normal-text)]/65 drop-shadow-none",
        )}
        onClick={() => setPaletteOpen((value) => !value)}
        onPointerDown={(event) => event.preventDefault()}
        title="Pintar turno"
        type="button"
      >
        <Paintbrush size={10} strokeWidth={2.4} />
      </button> : null}
      {assignedDoctor && editable ? (
        <button
          aria-label={`Quitar a ${assignedDoctor.shortName} del turno`}
          className="absolute right-0 top-0 z-40 grid h-[18px] w-4 place-items-center rounded-r text-white/75 drop-shadow-[0_1px_1px_rgba(0,0,0,.8)] transition hover:bg-black/15 hover:text-red-200"
          onClick={() => {
            setQuery("");
            setOpen(false);
            onAssign(null);
          }}
          onPointerDown={(event) => event.preventDefault()}
          title="Quitar médico"
          type="button"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      ) : null}
      {paletteOpen && editable ? (
        <div className="absolute left-0 top-5 z-[70] grid w-[104px] grid-cols-4 gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl">
          <button
            aria-label="Dejar turno con color normal"
            className="grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--line)] bg-[var(--shift-normal)] text-[8px] font-bold text-[var(--shift-normal-text)]"
            onClick={() => {
              onColor(null);
              setPaletteOpen(false);
            }}
            onPointerDown={(event) => event.preventDefault()}
            title="Normal"
            type="button"
          >
            ×
          </button>
          {SHIFT_COLOR_KEYS.map((colorKey) => (
            <button
              aria-label={`Pintar ${colorLegend.find((item) => item.key === colorKey)?.label ?? colorKey}`}
              className={cn(
                "h-5 w-5 rounded-full border-2 border-black/15 transition-transform hover:scale-110",
                marker?.colorKey === colorKey && "ring-2 ring-[var(--foreground)] ring-offset-1 ring-offset-[var(--surface)]",
              )}
              key={colorKey}
              onClick={() => {
                onColor(colorKey);
                setPaletteOpen(false);
              }}
              onPointerDown={(event) => event.preventDefault()}
              style={shiftColorStyle(colorKey)}
              title={colorLegend.find((item) => item.key === colorKey)?.label ?? colorKey}
              type="button"
            />
          ))}
        </div>
      ) : null}
      {open && editable && suggestions.length ? (
        <div className="absolute left-0 top-6 z-50 min-w-44 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xl">
          {suggestions.map((doctor) => (
            <button
              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-[var(--surface-soft)]"
              key={doctor.id}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(doctor);
              }}
              type="button"
            >
              <strong className="block text-xs">{doctor.longName}</strong>
              <small className="text-[10px] text-[var(--muted)]">{doctor.shortName}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EditableOnCallCard({
  week,
  slot,
  doctorId,
  colorKey,
  doctors,
  colorLegend,
  occupiedDoctorIds,
  highlightedDoctor,
  disabled,
  onAssign,
  onColor,
}: {
  week: string;
  slot: number;
  doctorId: string;
  colorKey: ShiftColorKey | null;
  doctors: Doctor[];
  colorLegend: ShiftColorLegendItem[];
  occupiedDoctorIds: string[];
  highlightedDoctor: string | null;
  disabled: boolean;
  onAssign: (doctorId: string) => void;
  onColor: (colorKey: ShiftColorKey | null) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `oncall:${week}:${slot}`, disabled });
  const assignedDoctor = doctors.find((doctor) => doctor.id === doctorId);
  const [query, setQuery] = useState(assignedDoctor?.shortName ?? "");
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const normalized = normalizeDoctorSearch(query);
  const suggestions = doctors
    .filter((doctor) => doctor.active && !occupiedDoctorIds.includes(doctor.id))
    .filter((doctor) => normalized.length >= 2 && (
      normalizeDoctorSearch(doctor.shortName).includes(normalized) ||
      normalizeDoctorSearch(doctor.longName).includes(normalized)
    ))
    .slice(0, 6);

  function choose(doctor: Doctor) {
    setQuery(doctor.shortName);
    setOpen(false);
    onAssign(doctor.id);
  }

  function validate() {
    if (!query.trim()) {
      onAssign("");
      setOpen(false);
      return;
    }
    const exact = doctors.find((doctor) => doctor.active &&
      [doctor.shortName, doctor.longName].some((name) =>
        normalizeDoctorSearch(name) === normalizeDoctorSearch(query)));
    if (exact && !occupiedDoctorIds.includes(exact.id)) choose(exact);
    else {
      setQuery(assignedDoctor?.shortName ?? "");
      setOpen(false);
      toast.error(exact ? "Ese médico ya está de llamado esta semana" : "Médico no encontrado. Agrégalo primero a la nómina.");
    }
  }

  return (
    <div className="group/shift relative" ref={setNodeRef}>
      <input
        aria-label={`Médico de llamado ${slot + 1}, semana ${week}`}
        className={cn(
          "relative z-30 block h-[18px] w-full rounded border border-[var(--shift-border)] bg-[var(--shift-normal)] py-0 pl-5 pr-5 text-center text-[9px] font-bold uppercase leading-[16px] text-[var(--shift-normal-text)] outline-none transition-[border-color,box-shadow,opacity] duration-150 focus:ring-2 focus:ring-[var(--brand)] sm:text-[10px]",
          isOver && "border-[var(--brand)] ring-2 ring-[var(--brand)]",
          highlightedDoctor && assignedDoctor?.id !== highlightedDoctor && "opacity-[.32]",
        )}
        disabled={disabled}
        onBlur={() => window.setTimeout(validate, 120)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (suggestions[0]) choose(suggestions[0]);
            else validate();
          }
          if (event.key === "Escape") {
            setQuery(assignedDoctor?.shortName ?? "");
            setOpen(false);
          }
        }}
        placeholder="-"
        style={shiftColorStyle(colorKey ?? undefined)}
        value={query}
      />
      <button
        aria-expanded={paletteOpen}
        aria-label={`Pintar llamado ${slot + 1} de la semana ${week}`}
        className={cn(
          "absolute left-0 top-0 z-40 grid h-[18px] w-4 place-items-center rounded-l text-white opacity-0 drop-shadow-[0_1px_1px_rgba(0,0,0,.9)] transition-opacity hover:bg-black/15 focus:opacity-100 group-hover/shift:opacity-100 group-focus-within/shift:opacity-100 [@media(hover:none)]:opacity-60",
          !colorKey && "text-[var(--shift-normal-text)]/65 drop-shadow-none",
        )}
        disabled={disabled}
        onClick={() => setPaletteOpen((value) => !value)}
        onPointerDown={(event) => event.preventDefault()}
        title="Pintar llamado"
        type="button"
      >
        <Paintbrush size={10} strokeWidth={2.4} />
      </button>
      {assignedDoctor ? <button
        aria-label={`Quitar a ${assignedDoctor.shortName} del llamado`}
        className="absolute right-0 top-0 z-40 grid h-[18px] w-4 place-items-center rounded-r text-white/75 drop-shadow-[0_1px_1px_rgba(0,0,0,.8)] transition hover:bg-black/15 hover:text-red-200"
        disabled={disabled}
        onClick={() => { setQuery(""); setOpen(false); onAssign(""); }}
        onPointerDown={(event) => event.preventDefault()}
        title="Quitar médico"
        type="button"
      ><X size={11} strokeWidth={2.5} /></button> : null}
      {paletteOpen && !disabled ? <div className="absolute left-0 top-5 z-[70] grid w-[104px] grid-cols-4 gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl">
        <button
          aria-label="Dejar llamado con color normal"
          className="grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--line)] bg-[var(--shift-normal)] text-[8px] font-bold text-[var(--shift-normal-text)]"
          onClick={() => { onColor(null); setPaletteOpen(false); }}
          onPointerDown={(event) => event.preventDefault()}
          title="Normal"
          type="button"
        >×</button>
        {SHIFT_COLOR_KEYS.map((key) => <button
          aria-label={`Pintar ${colorLegend.find((item) => item.key === key)?.label ?? key}`}
          className={cn(
            "h-5 w-5 rounded-full border-2 border-black/15 transition-transform hover:scale-110",
            colorKey === key && "ring-2 ring-[var(--foreground)] ring-offset-1 ring-offset-[var(--surface)]",
          )}
          key={key}
          onClick={() => { onColor(key); setPaletteOpen(false); }}
          onPointerDown={(event) => event.preventDefault()}
          style={shiftColorStyle(key)}
          title={colorLegend.find((item) => item.key === key)?.label ?? key}
          type="button"
        />)}
      </div> : null}
      {open && !disabled && suggestions.length ? <div className="absolute left-0 top-6 z-50 min-w-44 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xl">
        {suggestions.map((doctor) => <button
          className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-[var(--surface-soft)]"
          key={doctor.id}
          onMouseDown={(event) => { event.preventDefault(); choose(doctor); }}
          type="button"
        >
          <strong className="block text-xs">{doctor.longName}</strong>
          <small className="text-[10px] text-[var(--muted)]">{doctor.shortName}</small>
        </button>)}
      </div> : null}
    </div>
  );
}

function RosterEditor({
  doctors,
  onChange,
}: {
  doctors: Doctor[];
  onChange: (doctors: Doctor[]) => void;
}) {
  const [newLongName, setNewLongName] = useState("");
  const [newShortName, setNewShortName] = useState("");

  async function persist(doctor: Doctor, successMessage = "Nómina actualizada") {
    const previous = doctors;
    onChange(doctors.map((item) => (item.id === doctor.id ? doctor : item)));
    const response = await fetch("/api/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doctor),
    });
    if (!response.ok) {
      onChange(previous);
      const result = (await response.json()) as { error?: string };
      toast.error(result.error ?? "No fue posible guardar el médico");
      return false;
    } else {
      toast.success(successMessage);
      return true;
    }
  }

  async function removeDoctor(doctor: Doctor) {
    const confirmed = window.confirm(
      `¿Quitar a ${doctor.longName} de la nómina activa? Su historial se conservará.`,
    );
    if (!confirmed) return;
    await persist({ ...doctor, active: false }, "Médico retirado de la nómina");
  }

  async function addDoctor() {
    if (!newLongName.trim() || !newShortName.trim()) return;
    const normalizedShortName = normalizeDoctorSearch(newShortName);
    const existingDoctor = doctors.find(
      (doctor) => normalizeDoctorSearch(doctor.shortName) === normalizedShortName,
    );
    if (existingDoctor?.active) {
      toast.error("Ese nombre corto ya existe");
      return;
    }
    if (existingDoctor) {
      const reactivated = await persist(
        {
          ...existingDoctor,
          longName: newLongName.trim(),
          shortName: normalizedShortName,
          active: true,
        },
        "Médico reactivado",
      );
      if (reactivated) {
        setNewLongName("");
        setNewShortName("");
      }
      return;
    }
    const id = normalizedShortName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const doctor: Doctor = {
      id,
      longName: newLongName.trim(),
      shortName: normalizedShortName,
      active: true,
      sortOrder: doctors.length,
    };
    onChange([...doctors, doctor]);
    setNewLongName("");
    setNewShortName("");
    const response = await fetch("/api/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doctor),
    });
    if (!response.ok) toast.error("El médico quedó solo en esta vista hasta configurar la base");
    else toast.success("Médico agregado");
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-2xl">
      <h3 className="text-sm font-semibold">Nómina dinámica</h3>
      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
        Eliminar quita al médico de la nómina activa y del autocompletado, sin borrar su historial.
      </p>
      <div className="mt-3 grid gap-1.5 md:grid-cols-2">
        {doctors.filter((doctor) => doctor.active).map((doctor) => (
          <div
            className="grid grid-cols-[minmax(0,1.35fr)_minmax(80px,.75fr)_30px] gap-1 rounded-lg bg-[var(--surface-soft)] p-1.5"
            key={doctor.id}
          >
            <input
              aria-label={`Nombre largo de ${doctor.shortName}`}
              className="min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[10px]"
              onBlur={(event) => persist({ ...doctor, longName: event.target.value.trim() })}
              defaultValue={doctor.longName}
            />
            <input
              aria-label={`Nombre corto de ${doctor.longName}`}
              className="min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[10px] font-bold"
              onBlur={(event) =>
                persist({ ...doctor, shortName: normalizeDoctorSearch(event.target.value) })
              }
              defaultValue={doctor.shortName}
            />
            <button
              aria-label={`Eliminar ${doctor.longName} de la nómina`}
              className="grid h-[30px] w-[30px] place-items-center rounded-md text-[var(--muted)] transition hover:bg-red-100 hover:text-red-700"
              onClick={() => removeDoctor(doctor)}
              title="Quitar de la nómina activa"
              type="button"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-[minmax(0,1.35fr)_minmax(100px,.75fr)_32px]">
        <input
          className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[10px]"
          onChange={(event) => setNewLongName(event.target.value)}
          placeholder="Nombre largo"
          value={newLongName}
        />
        <input
          className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[10px]"
          onChange={(event) => setNewShortName(event.target.value)}
          placeholder="CORTO"
          value={newShortName}
        />
        <button
          aria-label="Agregar médico"
          className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand)] text-white"
          onClick={addDoctor}
          type="button"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

function ColorLegendEditor({
  items,
  scheduleId,
  scheduleLabel,
  onChange,
}: {
  items: ShiftColorLegendItem[];
  scheduleId: string;
  scheduleLabel: string;
  onChange: (items: ShiftColorLegendItem[]) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function saveLegend() {
    setSaving(true);
    const response = await fetch("/api/shift-colors", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleId, items }),
    });
    const result = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      toast.error(result.error ?? "No fue posible guardar la leyenda");
      return;
    }
    toast.success("Leyenda de colores guardada");
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <Palette size={13} className="text-[var(--brand)]" />
          <strong className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Colores · {scheduleLabel}
          </strong>
        </span>
        <button
          className="rounded-md bg-[var(--brand)] px-2 py-1 text-[9px] font-semibold text-white disabled:opacity-50"
          disabled={saving}
          onClick={saveLegend}
          type="button"
        >
          {saving ? "Guardando…" : "Guardar para este mes"}
        </button>
      </div>
      <div className="mt-2 grid gap-1">
        {items.map((item) => (
          <label className="flex items-center gap-2" key={item.key}>
            <i
              className="h-4 w-4 shrink-0 rounded-full border border-black/15"
              style={shiftColorStyle(item.key)}
            />
            <input
              aria-label={`Significado del color ${item.key}`}
              className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1 text-[10px]"
              maxLength={60}
              onChange={(event) =>
                onChange(
                  items.map((current) =>
                    current.key === item.key
                      ? { ...current, label: event.target.value }
                      : current,
                  ),
                )
              }
              value={item.label}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

type PendingScheduleChanges = {
  assignments: Record<string, ShiftAssignment | null>;
  markers: Record<string, ShiftMarker | null>;
};

const PENDING_SCHEDULE_STORAGE_KEY = "turnapp:schedule-pending-v1";
const PENDING_ONCALL_STORAGE_KEY = "turnapp:oncall-pending-v1";

function storePendingSchedules(value: Record<string, PendingScheduleChanges>) {
  try {
    if (Object.keys(value).length) localStorage.setItem(PENDING_SCHEDULE_STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(PENDING_SCHEDULE_STORAGE_KEY);
  } catch {
    // La cola sigue en memoria si el navegador no permite almacenamiento local.
  }
}

function shiftSlotKey(date: string, kind: ShiftKind, slot: number) {
  return `${date}-${kind}-${slot}`;
}

function ScheduleManager({
  initialDoctors,
  schedules,
  initialColorLegend,
  initialColorLegends,
  onCallWeeks,
  onOnCallSaved,
}: {
  initialDoctors: Doctor[];
  schedules: ScheduleMonth[];
  initialColorLegend: ShiftColorLegendItem[];
  initialColorLegends: Record<string, ShiftColorLegendItem[]>;
  onCallWeeks: OnCallWeek[];
  onOnCallSaved: () => Promise<void>;
}) {
  const [extraMonths, setExtraMonths] = useState<ScheduleMonth[]>([]);
  const sorted = useMemo(
    () => [...schedules, ...extraMonths].sort((a, b) => b.id.localeCompare(a.id)),
    [schedules, extraMonths],
  );
  const [selectedId, setSelectedId] = useState(sorted[0]?.id ?? "");
  const [creatingMonth, setCreatingMonth] = useState(false);
  const [newMonthValue, setNewMonthValue] = useState("");
  const initialSchedule = sorted.find((schedule) => schedule.id === selectedId) ?? sorted[0];
  const [doctors, setDoctors] = useState(initialDoctors);
  const [assignmentsByMonth, setAssignmentsByMonth] = useState<Record<string, ShiftAssignment[]>>(
    () => Object.fromEntries(sorted.map((schedule) => [schedule.id, schedule.assignments])),
  );
  const [markersByMonth, setMarkersByMonth] = useState<Record<string, ShiftMarker[]>>(
    () => Object.fromEntries(sorted.map((schedule) => [schedule.id, schedule.markers ?? []])),
  );
  const [colorLegendsByMonth, setColorLegendsByMonth] = useState(initialColorLegends);
  const [versions, setVersions] = useState<Record<string, number>>(
    () => Object.fromEntries(sorted.map((schedule) => [schedule.id, schedule.version ?? 1])),
  );
  const [editingRoster, setEditingRoster] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingScheduleChanges>>({});
  const pendingRef = useRef<Record<string, PendingScheduleChanges>>({});
  const [savingMonths, setSavingMonths] = useState<Record<string, boolean>>({});
  const [syncState, setSyncState] = useState<"synced" | "error">("synced");
  const [publishing, setPublishing] = useState(false);
  const [laneMode, setLaneMode] = useState(false);
  const [highlightedDoctor, setHighlightedDoctor] = useState<string | null>(null);
  const [weekEdits, setWeekEdits] = useState<Record<string, Pick<OnCallWeek, "doctorIds" | "colorKeys">>>({});
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [draggedDoctorId, setDraggedDoctorId] = useState<string | null>(null);
  const [overSlotId, setOverSlotId] = useState<string | null>(null);
  const schedule = sorted.find((item) => item.id === selectedId) ?? initialSchedule;
  const assignments = assignmentsByMonth[selectedId] ?? [];
  const markers = markersByMonth[selectedId] ?? [];
  const colorLegend = colorLegendsByMonth[selectedId] ?? initialColorLegend;
  const hasPendingChanges = Boolean(pendingChanges[selectedId]);
  const isSavingSelected = Boolean(savingMonths[selectedId]);
  const showOnCall = selectedId >= NEW_SYSTEM_START.slice(0, 7);
  const onCallByWeek = new Map(onCallWeeks.map((week) => [week.weekStart, week]));

  function editOnCallSlot(start: string, slot: number, change: { doctorId?: string; colorKey?: ShiftColorKey | null }) {
    setWeekEdits((current) => {
      const week = current[start] ?? onCallByWeek.get(start) ?? {
        doctorIds: ["", "", ""], colorKeys: [null, null, null],
      };
      return { ...current, [start]: {
        doctorIds: [0, 1, 2].map((position) =>
          position === slot && "doctorId" in change ? change.doctorId ?? "" : week.doctorIds[position] ?? ""),
        colorKeys: [0, 1, 2].map((position) =>
          position === slot && "colorKey" in change ? change.colorKey ?? null : week.colorKeys[position] ?? null),
      } };
    });
  }

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PENDING_ONCALL_STORAGE_KEY) ?? "{}") as Record<string, Pick<OnCallWeek, "doctorIds" | "colorKeys">>;
      if (stored && typeof stored === "object" && !Array.isArray(stored)) setWeekEdits(stored);
    } catch {
      // Los cambios siguen disponibles en memoria.
    }
    setDraftsLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftsLoaded) return;
    try {
      if (Object.keys(weekEdits).length) localStorage.setItem(PENDING_ONCALL_STORAGE_KEY, JSON.stringify(weekEdits));
      else localStorage.removeItem(PENDING_ONCALL_STORAGE_KEY);
    } catch {
      // Los cambios siguen disponibles en memoria.
    }
  }, [draftsLoaded, weekEdits]);

  const toggleHighlightedDoctor = useCallback((doctorId: string) => {
    setHighlightedDoctor((current) => current === doctorId ? null : doctorId);
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PENDING_SCHEDULE_STORAGE_KEY) ?? "{}") as Record<string, PendingScheduleChanges>;
      if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;
      const valid = Object.fromEntries(Object.entries(stored).filter(([id, changes]) =>
        /^\d{4}-\d{2}$/.test(id) && changes && typeof changes.assignments === "object" && typeof changes.markers === "object",
      ));
      if (!Object.keys(valid).length) return;
      pendingRef.current = valid;
      const timer = window.setTimeout(() => {
        const restored = pendingRef.current;
        setPendingChanges(restored);
        setAssignmentsByMonth((current) => {
          const next = { ...current };
          for (const [monthId, changes] of Object.entries(restored)) {
            const slots = new Map((next[monthId] ?? []).map((item) => [shiftSlotKey(item.date, item.kind, item.slot), item]));
            for (const [key, item] of Object.entries(changes.assignments)) {
              if (item) slots.set(key, item);
              else slots.delete(key);
            }
            next[monthId] = [...slots.values()];
          }
          return next;
        });
        setMarkersByMonth((current) => {
          const next = { ...current };
          for (const [monthId, changes] of Object.entries(restored)) {
            const slots = new Map((next[monthId] ?? []).map((item) => [shiftSlotKey(item.date, item.kind, item.slot), item]));
            for (const [key, item] of Object.entries(changes.markers)) {
              if (item) slots.set(key, item);
              else slots.delete(key);
            }
            next[monthId] = [...slots.values()];
          }
          return next;
        });
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      // Los datos inválidos no deben impedir abrir Jefatura.
    }
  }, []);

  function enqueueChanges(monthId: string, changes: Partial<PendingScheduleChanges>) {
    const next = {
      ...pendingRef.current,
      [monthId]: {
        assignments: { ...(pendingRef.current[monthId]?.assignments ?? {}), ...(changes.assignments ?? {}) },
        markers: { ...(pendingRef.current[monthId]?.markers ?? {}), ...(changes.markers ?? {}) },
      },
    };
    pendingRef.current = next;
    storePendingSchedules(next);
    setPendingChanges(next);
  }

  useEffect(() => {
    const pendingIds = Object.keys(pendingChanges).filter((id) => !savingMonths[id]);
    if (!pendingIds.length) return;
    const timer = window.setTimeout(() => {
      pendingIds.forEach((monthId) => {
        const batch = pendingChanges[monthId];
        if (!batch) return;
        let failed = false;
        setSavingMonths((current) => ({ ...current, [monthId]: true }));
        void fetch(`/api/schedules/${monthId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: monthId,
            assignments: Object.entries(batch.assignments).map(([key, assignment]) => {
              if (assignment) return { date: assignment.date, kind: assignment.kind, slot: assignment.slot, doctorId: assignment.doctorId };
              const [, date, kind, slot] = key.match(/^(.*)-(DAY|NIGHT)-(\d+)$/)!;
              return { date, kind, slot: Number(slot), doctorId: null };
            }),
            markers: Object.entries(batch.markers).map(([key, marker]) => {
              if (marker) return { date: marker.date, kind: marker.kind, slot: marker.slot, colorKey: marker.colorKey };
              const [, date, kind, slot] = key.match(/^(.*)-(DAY|NIGHT)-(\d+)$/)!;
              return { date, kind, slot: Number(slot), colorKey: null };
            }),
          }),
        }).then(async (response) => {
          const result = (await response.json()) as { error?: string; version?: number };
          if (!response.ok) throw new Error(result.error ?? "No fue posible guardar");
          const latest = pendingRef.current[monthId];
          if (latest) {
            const assignments = { ...latest.assignments };
            const markers = { ...latest.markers };
            for (const [key, value] of Object.entries(batch.assignments)) {
              if (assignments[key] === value) delete assignments[key];
            }
            for (const [key, value] of Object.entries(batch.markers)) {
              if (markers[key] === value) delete markers[key];
            }
            const next = { ...pendingRef.current };
            if (Object.keys(assignments).length || Object.keys(markers).length) next[monthId] = { assignments, markers };
            else delete next[monthId];
            pendingRef.current = next;
            storePendingSchedules(next);
            setPendingChanges(next);
          }
          // Mantener la versión observada hasta leer el estado completo del servidor.
        }).catch((error: Error) => {
          failed = true;
          setSyncState("error");
          toast.error(error.message);
        }).finally(() => {
          const release = () => setSavingMonths((current) => ({ ...current, [monthId]: false }));
          if (failed) window.setTimeout(release, 5000);
          else release();
        });
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [pendingChanges, savingMonths]);

  useEffect(() => {
    if (!selectedId || pendingChanges[selectedId] || savingMonths[selectedId]) return;
    let cancelled = false;
    const syncFromServer = async () => {
      try {
        const response = await fetch(`/api/schedules/${selectedId}`);
        if (!response.ok || cancelled) return;
        const remote = await response.json() as ScheduleMonth;
        if ((remote.version ?? 0) <= (versions[selectedId] ?? 0) || cancelled || pendingRef.current[selectedId]) return;
        setAssignmentsByMonth((current) => ({ ...current, [selectedId]: remote.assignments }));
        setMarkersByMonth((current) => ({ ...current, [selectedId]: remote.markers ?? [] }));
        setVersions((current) => ({ ...current, [selectedId]: remote.version ?? current[selectedId] }));
        setSyncState("synced");
      } catch {
        // El siguiente sondeo reintentará; los cambios pendientes se mantienen.
      }
    };
    void syncFromServer();
    const interval = window.setInterval(() => void syncFromServer(), 3500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [pendingChanges, savingMonths, selectedId, versions]);

  async function publishMonth() {
    if (pendingRef.current[selectedId] || hasPendingChanges || isSavingSelected || publishing) {
      toast.message("Esperando que los cambios se sincronicen antes de publicar.");
      return;
    }
    setPublishing(true);
    try {
      const editedWeeks = Object.entries(weekEdits).filter(([start]) => {
        const end = addDays(new Date(`${start}T12:00:00`), 6);
        return monthKey(end.getFullYear(), end.getMonth() + 1) === selectedId;
      });
      for (const [, edited] of editedWeeks) {
        const filled = edited.doctorIds.filter(Boolean);
        if (new Set(filled).size !== filled.length) throw new Error("Un médico no puede ocupar dos cupos de llamado de la misma semana");
      }
      for (const [start, edited] of editedWeeks) {
        const onCallResponse = await fetch("/api/november", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "oncall.set", weekStart: start, ...edited }),
        });
        const onCallResult = await onCallResponse.json() as { error?: string };
        if (!onCallResponse.ok) throw new Error(onCallResult.error ?? "No fue posible guardar el llamado");
      }
      const response = await fetch(`/api/schedules/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, publish: true }),
      });
      const result = (await response.json()) as { error?: string; version?: number };
      if (!response.ok) throw new Error(result.error ?? "No fue posible publicar");
      if (editedWeeks.length) {
        await onOnCallSaved();
        setWeekEdits((current) => {
          const next = { ...current };
          editedWeeks.forEach(([start]) => { delete next[start]; });
          return next;
        });
      }
      toast.success("Mes publicado en Turnos");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible publicar");
    } finally {
      setPublishing(false);
    }
  }

  if (!schedule) return <p>No hay calendarios disponibles.</p>;

  function assignToDates(
    dates: string[],
    kind: ShiftKind,
    slot: number,
    doctorId: string | null,
  ) {
    setAssignmentsByMonth((current) => {
      const targetDates = new Set(dates);
      const withoutSlot = (current[selectedId] ?? []).filter(
        (item) => !(targetDates.has(item.date) && item.kind === kind && item.slot === slot),
      );
      const next = doctorId
        ? [
            ...withoutSlot,
            ...dates.map((date) => ({
              id: `${selectedId}-${date}-${kind.toLowerCase()}-${slot}`,
              date,
              kind,
              slot,
              doctorId,
            })),
          ]
        : withoutSlot;
      return { ...current, [selectedId]: next };
    });
    dates.forEach((date) => enqueueChanges(selectedId, { assignments: { [shiftSlotKey(date, kind, slot)]: doctorId ? { id: `${selectedId}-${date}-${kind.toLowerCase()}-${slot}`, date, kind, slot, doctorId } : null } }));
  }

  function assign(date: string, kind: ShiftKind, slot: number, doctorId: string | null) {
    assignToDates([date], kind, slot, doctorId);
  }

  function paint(date: string, kind: ShiftKind, slot: number, colorKey: ShiftColorKey | null) {
    setMarkersByMonth((current) => {
      const existing = (current[selectedId] ?? []).filter(
        (item) => !(item.date === date && item.kind === kind && item.slot === slot),
      );
      const next = colorKey
        ? [
            ...existing,
            {
              id: `${selectedId}-${date}-${kind.toLowerCase()}-${slot}-color`,
              date,
              kind,
              slot,
              colorKey,
            },
          ]
        : existing;
      return { ...current, [selectedId]: next };
    });
    enqueueChanges(selectedId, { markers: { [shiftSlotKey(date, kind, slot)]: colorKey ? { id: `${selectedId}-${date}-${kind.toLowerCase()}-${slot}-color`, date, kind, slot, colorKey } : null } });
  }

  function laneDates(date: string) {
    const dates: string[] = [];
    const final = new Date(schedule.year, schedule.month, 0, 12);
    let cursor = new Date(`${date}T12:00:00`);

    while (cursor <= final) {
      if (
        cursor.getFullYear() === schedule.year &&
        cursor.getMonth() + 1 === schedule.month
      ) {
        dates.push(
          `${monthKey(cursor.getFullYear(), cursor.getMonth() + 1)}-${String(cursor.getDate()).padStart(2, "0")}`,
        );
      }
      cursor = addDays(cursor, 6);
    }
    return dates;
  }

  function onDragStart(event: DragStartEvent) {
    setDraggedDoctorId(String(event.active.id).replace("doctor:", ""));
  }

  function onDragOver(event: DragOverEvent) {
    const target = event.over ? String(event.over.id) : null;
    setOverSlotId(target?.startsWith("slot:") ? target : null);
  }

  function onDragEnd(event: DragEndEvent) {
    const doctorId = String(event.active.id).replace("doctor:", "");
    const target = event.over ? String(event.over.id) : "";
    setDraggedDoctorId(null);
    setOverSlotId(null);
    if (target.startsWith("oncall:")) {
      const [, start, slotText] = target.split(":");
      const slot = Number(slotText);
      const week = weekEdits[start] ?? onCallByWeek.get(start) ?? { doctorIds: ["", "", ""] };
      if (!showOnCall || ![0, 1, 2].includes(slot)) return;
      if (week.doctorIds.some((id, position) => position !== slot && id === doctorId)) {
        toast.error("Ese médico ya está de llamado esta semana");
        return;
      }
      editOnCallSlot(start, slot, { doctorId });
      return;
    }
    if (!target.startsWith("slot:")) return;
    const [, date, kind, slot] = target.split(":");
    if (!date.startsWith(`${selectedId}-`)) return;
    if (laneMode) {
      assignToDates(laneDates(date), kind as ShiftKind, Number(slot), doctorId);
    } else {
      assign(date, kind as ShiftKind, Number(slot), doctorId);
    }
  }

  function cancelDrag() {
    setDraggedDoctorId(null);
    setOverSlotId(null);
  }

  function createMonth() {
    if (!newMonthValue) return;
    const [yearText, monthText] = newMonthValue.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const id = `${yearText}-${monthText}`;
    if (sorted.some((item) => item.id === id)) {
      toast.error("Ese mes ya existe");
      setSelectedId(id);
      return;
    }
    setExtraMonths((current) => [...current, { id, year, month, status: "draft", version: 1, assignments: [], markers: [] }]);
    setAssignmentsByMonth((current) => ({ ...current, [id]: [] }));
    setMarkersByMonth((current) => ({ ...current, [id]: [] }));
    setVersions((current) => ({ ...current, [id]: 1 }));
    enqueueChanges(id, {});
    setSelectedId(id);
    setCreatingMonth(false);
    setNewMonthValue("");
    toast.success("Mes creado como borrador. Los cambios se guardan automáticamente.");
  }


  const slots = new Map(
    assignments.map((assignment) => [
      `${assignment.date}-${assignment.kind}-${assignment.slot}`,
      assignment,
    ]),
  );
  const markerSlots = new Map(
    markers.map((marker) => [
      `${marker.date}-${marker.kind}-${marker.slot}`,
      marker,
    ]),
  );
  const scheduleSnapshots = sorted.map((item) => ({
    ...item,
    assignments: assignmentsByMonth[item.id] ?? item.assignments,
    markers: markersByMonth[item.id] ?? item.markers ?? [],
  }));
  const allAssignments = scheduleSnapshots.flatMap((item) => item.assignments);
  const conflicts = findNightToDayConflicts(allAssignments);
  const conflictAssignmentIds = incompatibleAssignmentIds(allAssignments, conflicts);
  const visibleDateKeys = new Set(calendarDays(schedule.year, schedule.month).map((date) =>
    `${monthKey(date.getFullYear(), date.getMonth() + 1)}-${String(date.getDate()).padStart(2, "0")}`,
  ));
  const allSlots = new Map(
    scheduleSnapshots.flatMap((item) =>
      item.assignments.map((assignment) => [
        `${assignment.date}-${assignment.kind}-${assignment.slot}`,
        assignment,
      ] as const),
    ),
  );
  const allMarkerSlots = new Map(
    scheduleSnapshots.flatMap((item) =>
      (item.markers ?? []).map((marker) => [
        `${marker.date}-${marker.kind}-${marker.slot}`,
        marker,
      ] as const),
    ),
  );
  const lanePreview = new Set<string>();
  if (laneMode && draggedDoctorId && overSlotId) {
    const [, date, kind, slot] = overSlotId.split(":");
    laneDates(date).forEach((laneDate) => lanePreview.add(`${laneDate}-${kind}-${slot}`));
  }

  return (
    <DndContext
      onDragCancel={cancelDrag}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
    >
      <div className="relative grid gap-3 xl:grid-cols-[minmax(680px,1fr)_230px]">
        <section
          className={cn(
            "min-w-0 transition",
            editingRoster && "pointer-events-none opacity-20",
          )}
        >
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium capitalize"
                onChange={(event) => setSelectedId(event.target.value)}
                value={selectedId}
              >
                {sorted.map((item) => (
                  <option key={item.id} value={item.id}>
                    {monthLabel(item.year, item.month)}
                  </option>
                ))}
              </select>
              {creatingMonth ? (
                <span className="flex items-center gap-1.5">
                  <input
                    className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                    onChange={(event) => setNewMonthValue(event.target.value)}
                    type="month"
                    value={newMonthValue}
                  />
                  <button
                    className="rounded-lg bg-[var(--brand)] px-2.5 py-1.5 text-xs font-medium text-white"
                    onClick={createMonth}
                    type="button"
                  >
                    Crear
                  </button>
                  <button
                    className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs"
                    onClick={() => { setCreatingMonth(false); setNewMonthValue(""); }}
                    type="button"
                  >
                    <X size={13} />
                  </button>
                </span>
              ) : (
                <button
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium"
                  onClick={() => setCreatingMonth(true)}
                  type="button"
                >
                  <CalendarPlus size={15} /> Nuevo mes
                </button>
              )}
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
              <button
                aria-checked={laneMode}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  laneMode
                    ? "border-purple-600 bg-purple-600 text-white"
                    : "border-purple-400 bg-[var(--surface)] text-purple-600",
                )}
                onClick={() => setLaneMode((value) => !value)}
                role="switch"
                type="button"
              >
                <span
                  className={cn(
                    "relative block h-4 w-7 shrink-0 rounded-full transition-colors",
                    laneMode ? "bg-purple-300" : "bg-[var(--surface-soft)]",
                  )}
                >
                  <i
                    className={cn(
                      "absolute top-0.5 h-3 w-3 rounded-full transition-[left,background-color]",
                      laneMode
                        ? "left-[14px] bg-white"
                        : "left-0.5 bg-[var(--muted)]",
                    )}
                  />
                </span>
                <span>Carriles de Turno</span>
              </button>
              <span aria-live="polite" className={cn("self-center text-[10px]", syncState === "error" ? "text-red-600" : "text-[var(--muted)]")}>
                {isSavingSelected || hasPendingChanges ? "Guardando…" : syncState === "error" ? "Sin conexión" : "Sincronizado"}
              </span>
              <button
                className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-2.5 py-1.5 text-xs font-medium text-white transition-shadow disabled:cursor-wait disabled:shadow-inner disabled:opacity-70"
                disabled={publishing || hasPendingChanges || isSavingSelected}
                onClick={publishMonth}
                type="button"
              >
                {publishing ? <LoaderCircle className="animate-spin" size={15} /> : <CalendarCheck size={15} />} Publicar mes
              </button>
            </div>
          </div>
          <ScheduleConflictNotice conflicts={conflicts} doctors={doctors} visibleDates={visibleDateKeys} />
          <div className="scrollbar-subtle overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
            <div className={cn("grid gap-1", showOnCall
              ? "min-w-[760px] grid-cols-8"
              : "min-w-[680px] grid-cols-7")}>
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                <div className="pb-1 text-center text-[9px] font-semibold text-[var(--muted)]" key={day}>
                  {day}
                </div>
              ))}
              {showOnCall ? <div className="pb-1 text-center text-[9px] font-semibold text-[var(--muted)]">Llamado</div> : null}
              {calendarDays(schedule.year, schedule.month).map((date, index) => {
                const dateKey = `${monthKey(date.getFullYear(), date.getMonth() + 1)}-${String(date.getDate()).padStart(2, "0")}`;
                const inMonth = date.getMonth() + 1 === schedule.month;
                const start = weekStart(dateKey);
                const storedWeek = onCallByWeek.get(start);
                const selectedWeek = weekEdits[start] ?? storedWeek ?? { doctorIds: ["", "", ""], colorKeys: [null, null, null] };
                return (
                  <div className="contents" key={dateKey}>
                  <div
                    className={cn(
                      "relative min-h-[105px] rounded-lg border border-[var(--line)] p-1",
                      inMonth ? "bg-[var(--surface-soft)]" : "bg-[var(--surface-soft)] opacity-55",
                    )}
                  >
                    <span className="block text-right text-[9px] leading-3 text-[var(--muted)]">
                      {date.getDate()}
                    </span>

                    <div className="space-y-0.5">
                      {([1, 2, 3] as const).map((slot) => (
                        <EditableShiftCard
                          assignment={(inMonth ? slots : allSlots).get(`${dateKey}-DAY-${slot}`)}
                          colorLegend={colorLegend}
                          date={dateKey}
                          doctors={doctors}
                          key={`day-${slot}-${(inMonth ? slots : allSlots).get(`${dateKey}-DAY-${slot}`)?.doctorId ?? "empty"}`}
                          kind="DAY"
                          laneHighlighted={lanePreview.has(`${dateKey}-DAY-${slot}`)}
                          hasIncompatibility={conflictAssignmentIds.has((inMonth ? slots : allSlots).get(`${dateKey}-DAY-${slot}`)?.id ?? "")}
                          highlightedDoctor={highlightedDoctor}
                          marker={(inMonth ? markerSlots : allMarkerSlots).get(`${dateKey}-DAY-${slot}`)}
                          editable={inMonth}
                          onAssign={(doctorId) => { if (inMonth) assign(dateKey, "DAY", slot, doctorId); }}
                          onColor={(colorKey) => { if (inMonth) paint(dateKey, "DAY", slot, colorKey); }}
                          slot={slot}
                        />
                      ))}
                      <div aria-hidden className="mx-1 my-1 h-px bg-[var(--shift-divider)]" />
                      {([1, 2] as const).map((slot) => (
                        <EditableShiftCard
                          assignment={(inMonth ? slots : allSlots).get(`${dateKey}-NIGHT-${slot}`)}
                          colorLegend={colorLegend}
                          date={dateKey}
                          doctors={doctors}
                          key={`night-${slot}-${(inMonth ? slots : allSlots).get(`${dateKey}-NIGHT-${slot}`)?.doctorId ?? "empty"}`}
                          kind="NIGHT"
                          laneHighlighted={lanePreview.has(`${dateKey}-NIGHT-${slot}`)}
                          hasIncompatibility={conflictAssignmentIds.has((inMonth ? slots : allSlots).get(`${dateKey}-NIGHT-${slot}`)?.id ?? "")}
                          highlightedDoctor={highlightedDoctor}
                          marker={(inMonth ? markerSlots : allMarkerSlots).get(`${dateKey}-NIGHT-${slot}`)}
                          editable={inMonth}
                          onAssign={(doctorId) => { if (inMonth) assign(dateKey, "NIGHT", slot, doctorId); }}
                          onColor={(colorKey) => { if (inMonth) paint(dateKey, "NIGHT", slot, colorKey); }}
                          slot={slot}
                        />
                      ))}
                    </div>
                  </div>
                  {showOnCall && index % 7 === 6 ? <div className="relative flex min-h-[105px] flex-col rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-1">
                    <span className="block text-right text-[9px] leading-3 text-[var(--muted)]" title={`Semana del ${start}`}>
                      Semana {start.slice(5)}
                    </span>
                    <div className="space-y-0.5">
                      {[0, 1, 2].map((slot) => <EditableOnCallCard
                        colorKey={selectedWeek.colorKeys[slot] ?? null}
                        colorLegend={colorLegend}
                        disabled={publishing}
                        doctorId={selectedWeek.doctorIds[slot] ?? ""}
                        doctors={doctors}
                        highlightedDoctor={highlightedDoctor}
                        key={`${start}-${slot}-${selectedWeek.doctorIds[slot] ?? ""}`}
                        occupiedDoctorIds={selectedWeek.doctorIds.filter((id, position) => position !== slot && Boolean(id))}
                        onAssign={(doctorId) => editOnCallSlot(start, slot, { doctorId })}
                        onColor={(colorKey) => editOnCallSlot(start, slot, { colorKey })}
                        slot={slot}
                        week={start}
                      />)}
                      <div aria-hidden className="mx-1 my-1 h-px bg-[var(--shift-divider)]" />
                    </div>
                    <div className="mt-auto flex items-center justify-end gap-1">
                      {storedWeek?.needsReview ? <span className="text-[8px] text-amber-700" title="Revisar cambios de turnos o ausencia">Revisar</span> : null}
                      {weekEdits[start] ? <span className="text-[8px] text-[var(--muted)]">Pendiente de publicar</span> : null}

                    </div>
                  </div> : null}
                  </div>
                );
              })}
            </div>
          </div>
          <ScheduleManagerMiniAnalysis
            doctors={doctors}
            month={schedule.month}
            schedules={scheduleSnapshots}
            year={schedule.year}
          />
        </section>
        <aside
          className={cn(
            "space-y-2",
            editingRoster &&
              "absolute right-0 top-0 z-20 w-full rounded-2xl bg-[var(--background)]/95 p-2 shadow-2xl backdrop-blur sm:w-[min(760px,calc(100%-1rem))]",
          )}
        >
          <button
            className="flex w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-medium"
            onClick={() => setEditingRoster((value) => !value)}
            type="button"
          >
            <span className="flex items-center gap-2">
              <Settings2 size={17} /> Editar médicos
            </span>
            {editingRoster ? <X size={16} /> : null}
          </button>
          {editingRoster ? (
            <RosterEditor doctors={doctors} onChange={setDoctors} />
          ) : (
            <>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-2">
                <p className="mb-2 text-[10px] text-[var(--muted)]">
                  Arrastra o escribe directamente en una tarjeta.
                </p>
                <div className="grid gap-1">
                  {doctors
                    .filter((doctor) => doctor.active)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((doctor) => (
                      <DoctorDragCard
                        doctor={doctor}
                        highlightedDoctor={highlightedDoctor}
                        key={doctor.id}
                        onHighlight={setHighlightedDoctor}
                        onToggleHighlight={toggleHighlightedDoctor}
                      />
                    ))}
                </div>
              </div>
              <ColorLegendEditor
                items={colorLegend}
                scheduleId={selectedId}
                scheduleLabel={schedule ? monthLabel(schedule.year, schedule.month) : selectedId}
                onChange={(items) => setColorLegendsByMonth((current) => ({ ...current, [selectedId]: items }))}
              />
            </>
          )}
        </aside>
        {publishing ? <div aria-live="polite" className="absolute inset-0 z-40 grid place-items-center rounded-2xl bg-[var(--background)]/45 backdrop-blur-[1px]"><div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold shadow-2xl"><LoaderCircle className="animate-spin text-[var(--brand)]" size={19} />Publicando mes…</div></div> : null}
      </div>
    </DndContext>
  );
}


type ManagerAnalysisSortKey = "doctor" | "month" | "day" | "night" | "trailingThreeMonths" | "difference" | "weekend" | "trailingWeekend";

const managerAnalysisHeaders: Array<{ label: string; field: ManagerAnalysisSortKey; className?: string }> = [
  { label: "Médico", field: "doctor", className: "px-3 text-left" },
  { label: "Mes", field: "month" },
  { label: "Día", field: "day" },
  { label: "Noche", field: "night" },
  { label: "FDS", field: "weekend" },
  { label: "FDS 3 meses", field: "trailingWeekend", className: "px-3" },
  { label: "Últ. 3 meses", field: "trailingThreeMonths" },
  { label: "Dif.", field: "difference" },
];

function ScheduleManagerMiniAnalysis({
  doctors,
  schedules,
  year,
  month,
}: {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  year: number;
  month: number;
}) {
  const [sort, setSort] = useState<{ key: ManagerAnalysisSortKey; direction: "asc" | "desc" }>({
    key: "month",
    direction: "asc",
  });
  const summary = useMemo(
    () => buildScheduleManagerAnalysis({ doctors, schedules, year, month }),
    [doctors, schedules, year, month],
  );
  const rows = [...summary.rows].sort((a, b) => {
    const first = sort.key === "doctor" ? a.doctor.shortName : a[sort.key];
    const second = sort.key === "doctor" ? b.doctor.shortName : b[sort.key];
    const comparison = typeof first === "string"
      ? first.localeCompare(String(second), "es-CL")
      : Number(first) - Number(second);
    return sort.direction === "asc" ? comparison : -comparison;
  });

  function toggleSort(key: ManagerAnalysisSortKey) {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: key === "doctor" ? "asc" : "desc" });
  }

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-baseline justify-between gap-1 border-b border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
        <div>
          <h3 className="text-xs font-semibold">Análisis Mensual</h3>
          <p className="text-[10px] text-[var(--muted)]">FDS incluye sábado, domingo y noche de viernes.</p>
        </div>
        <span className="text-[10px] text-[var(--muted)]">Promedio actual: {summary.expectedMonthlyShifts.toFixed(1)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[11px]">
          <thead className="text-[var(--muted)]">
            <tr>
              {managerAnalysisHeaders.map(({ label, field, className }) => {
                const active = sort.key === field;
                return (
                  <th className={cn("px-2 py-2 text-center font-medium", className)} key={field}>
                    <button className="inline-flex items-center gap-1 hover:text-[var(--foreground)]" onClick={() => toggleSort(field)} type="button">
                      {label}<span className={active ? "text-[var(--brand)]" : "opacity-45"}>{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-t border-[var(--line)]" key={row.doctor.id}>
                <th className="px-3 py-1.5 text-left font-semibold">{row.doctor.shortName}</th>
                <td className="px-2 py-1.5 text-center">{row.month}</td>
                <td className="px-2 py-1.5 text-center">{row.day}</td>
                <td className="px-2 py-1.5 text-center">{row.night}</td>
                <td className="px-2 py-1.5 text-center">{row.weekend}</td>
                <td className="px-3 py-1.5 text-center">{row.trailingWeekend}</td>
                <td className="px-2 py-1.5 text-center">{row.trailingThreeMonths}</td>
                <td className={cn("px-2 py-1.5 text-center font-semibold", row.difference > 0.5 ? "text-amber-600" : row.difference < -0.5 ? "text-sky-600" : "text-[var(--brand)]")}>
                  {row.difference > 0 ? "+" : ""}{row.difference.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ScoreManager({
  doctors,
  schedules,
  types,
  recent,
  holidays,
  november,
  onNovemberUpdate,
}: {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  types: ReplacementType[];
  recent: Replacement[];
  holidays: Holiday[];
  november: NovemberData;
  onNovemberUpdate: (data: NovemberData) => void;
}) {
  const formTypes = types.filter((type) => type.code !== "HERO");
  const [date, setDate] = useState(santiagoParts(new Date()).date);
  const [doctorId, setDoctorId] = useState(doctors.find((doctor) => doctor.active)?.id ?? "");
  const [shift, setShift] = useState<ReplacementShift>("day");
  const [scoreType, setScoreType] = useState<"replacement" | "base">("replacement");
  const [mode, setMode] = useState<"voluntary" | "invoked">("voluntary");
  const [superhero, setSuperhero] = useState(false);
  const holidayDates = useMemo(
    () => new Set(holidays.map((holiday) => holiday.date)),
    [holidays],
  );
  const automaticType = getAutomaticReplacementType({
    date,
    shift,
    types: formTypes,
    holidays: holidayDates,
  });
  const [points, setPoints] = useState(() =>
    getAutomaticReplacementType({
      date,
      shift: "day",
      types: formTypes,
      holidays: holidayDates,
    })?.defaultPoints ?? 0,
  );
  const [history, setHistory] = useState(() =>
    recent.filter((item) => item.typeCode !== "BASE")
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15),
  );
  const [allRecords, setAllRecords] = useState(recent);
  const fichas = date >= NEW_SYSTEM_START ? availableFichas(allRecords, doctorId, date) : null;
  const fichaCost = shift === "both" ? 2 : 1;
  const fichaBlocked = scoreType === "replacement" && mode === "voluntary" && fichas !== null && fichas < fichaCost;
  const doctorsById = new Map(doctors.map((doctor) => [doctor.id, doctor]));
  const automaticBase = basePointRecords({
    schedules, absences: november.absences, corrections: november.corrections,
    freezes: november.freezes, at: new Date().toISOString(), includeExpired: true,
  });
  const manualBase = allRecords.filter((item) => item.typeCode === "BASE");
  const baseEntries = [
    ...automaticBase.map((item) => ({
      key: `assignment-${item.assignmentId}`, doctorId: item.doctorId, date: item.date,
      assignmentId: item.assignmentId, replacement: null as Replacement | null,
    })),
    ...manualBase.map((item) => ({
      key: `manual-${item.id}`, doctorId: item.doctorId, date: item.date,
      assignmentId: null as string | null, replacement: item as Replacement | null,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  function selectShift(nextShift: ReplacementShift, nextDate = date) {
    setShift(nextShift);
    const nextType = getAutomaticReplacementType({
      date: nextDate,
      shift: nextShift,
      types: formTypes,
      holidays: holidayDates,
    });
    setPoints((nextType?.defaultPoints ?? 0) + (superhero ? 1 : 0));
  }

  function selectDate(nextDate: string) {
    setDate(nextDate);
    selectShift(shift, nextDate);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (fichaBlocked) {
      toast.error("Médico sin fichas para otro reemplazo voluntario");
      return;
    }
    const replacement = {
      id: crypto.randomUUID(),
      date,
      doctorId,
      typeCode: scoreType === "base" ? "BASE" : automaticType?.code ?? "LEGACY_UNKNOWN",
      points: scoreType === "base" ? 1 : points,
      mode: scoreType === "base" ? "voluntary" : mode,
      superhero: scoreType === "base" ? false : superhero,
      expiresAt: addDays(new Date(`${date}T12:00:00`), 120)
        .toISOString()
        .slice(0, 10),
    };
    const response = await fetch("/api/replacements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(replacement),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) toast.error(result.error ?? "No fue posible guardar");
    else {
      setAllRecords((current) => [replacement, ...current]);
      if (scoreType === "replacement") setHistory((current) =>
        [replacement, ...current]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 15),
      );
      toast.success("Puntaje guardado");
    }
  }

  async function removeBase(assignmentId: string) {
    if (!window.confirm("¿Eliminar este punto base del turno?")) return;
    try {
      const response = await fetch("/api/november", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "base.set", assignmentId, worked: false, reason: "Punto base eliminado en Jefatura" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible eliminar el punto base");
      const refreshed = await fetch("/api/november", { cache: "no-store" });
      const next = await refreshed.json() as NovemberData & { error?: string };
      if (!refreshed.ok) throw new Error(next.error ?? "No fue posible actualizar los puntos base");
      onNovemberUpdate(next);
      toast.success("Punto base eliminado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible eliminar el punto base");
    }
  }

  async function removeReplacement(replacement: Replacement) {
    if (!window.confirm(`¿Eliminar el puntaje de ${doctorsById.get(replacement.doctorId)?.shortName ?? "este médico"} del ${replacement.date}?`)) return;
    const response = await fetch("/api/replacements", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: replacement.id }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(result.error ?? "No fue posible eliminar el puntaje");
      return;
    }
    setHistory((current) => current.filter((item) => item.id !== replacement.id));
    setAllRecords((current) => current.filter((item) => item.id !== replacement.id));
    toast.success("Puntaje eliminado");
  }

  return (
    <div className="space-y-3">
      <form
        className="mx-auto w-full max-w-[1240px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3"
        onSubmit={submit}
      >
        <div className="flex items-center gap-2">
          <Star size={17} className="text-[var(--brand)]" />
          <h2 className="text-sm font-semibold">Agregar puntaje nuevo</h2>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2.5">
          <label className="w-full text-xs text-[var(--muted)] sm:w-[160px]">
            Fecha
            <input
              className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
              onChange={(event) => selectDate(event.target.value)}
              type="date"
              value={date}
            />
          </label>
          <label className="w-full text-xs text-[var(--muted)] sm:w-[240px]">
            Médico
            <select
              className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
              onChange={(event) => setDoctorId(event.target.value)}
              value={doctorId}
            >
              {doctors
                .filter((doctor) => doctor.active)
                .map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.shortName} · {doctor.longName}
                  </option>
                ))}
            </select>
          </label>
          <label className="w-full text-xs text-[var(--muted)] sm:w-[150px]">
              Tipo de puntaje
              <select
                className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
                onChange={(event) => setScoreType(event.target.value as "replacement" | "base")}
                value={scoreType}
              >
                <option value="replacement">Reemplazo</option>
                <option value="base">Punto Base</option>
              </select>
          </label>
          {scoreType === "replacement" ? <>
            <fieldset className="w-full text-xs text-[var(--muted)] sm:w-[170px]">
              <legend>Turno</legend>
              <div className="mt-1 grid h-[31px] grid-cols-3 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-soft)]">
                {([
                  ["day", "Día"],
                  ["night", "Noche"],
                  ["both", "24 horas"],
                ] as const).map(([value, label]) => (
                  <label
                    className={cn(
                      "flex cursor-pointer items-center justify-center whitespace-nowrap text-[10px] font-medium transition",
                      value !== "day" && "border-l border-[var(--line)]",
                      shift === value && "bg-[var(--brand)] text-white",
                    )}
                    key={value}
                  >
                    <input
                      checked={shift === value}
                      className="sr-only"
                      name="replacement-shift"
                      onChange={() => selectShift(value)}
                      type="radio"
                      value={value}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="w-full sm:w-[225px]">
              <legend className="text-xs text-[var(--muted)]">Condición</legend>
              <div className="mt-1 grid h-[31px] grid-cols-2 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-soft)]">
                <label className={cn("flex cursor-pointer items-center justify-center gap-1.5 px-2 text-[10px] font-medium transition", mode === "invoked" && "bg-[var(--brand)] text-white")}>
                  <input
                    checked={mode === "invoked"}
                    className="sr-only"
                    onChange={(event) => setMode(event.target.checked ? "invoked" : "voluntary")}
                    type="checkbox"
                  />
                  🪽 Convocado
                </label>
                <label className={cn("flex cursor-pointer items-center justify-center gap-1.5 border-l border-[var(--line)] px-2 text-[10px] font-medium transition", superhero && "bg-[var(--brand)] text-white")}>
                  <input
                    checked={superhero}
                    className="sr-only"
                    onChange={(event) => {
                      setSuperhero(event.target.checked);
                      setPoints((value) => Math.max(0, value + (event.target.checked ? 1 : -1)));
                    }}
                    type="checkbox"
                  />
                  🦸 Superhéroe
                </label>
              </div>
            </fieldset>
          </> : null}
          <label className="w-full text-xs text-[var(--muted)] sm:w-[80px]">
            Puntos
            <input
              className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
              disabled={scoreType === "base"}
              max={20}
              min={0}
              onChange={(event) => setPoints(Number(event.target.value))}
              type="number"
              value={scoreType === "base" ? 1 : points}
            />
          </label>
          <button
            className="flex h-[31px] w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white sm:w-[105px]"
            disabled={fichaBlocked}
            type="submit"
          >
            <Save size={14} /> Guardar
          </button>
        </div>
        {scoreType === "replacement" && fichas !== null ? <p className="mt-2 text-xs text-[var(--muted)]">Fichas disponibles: {fichas}/2. Las convocatorias no requieren fichas.</p> : null}
      </form>
      <div className="grid gap-3 xl:grid-cols-3">
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <h2 className="text-sm font-semibold">Últimos voluntarios e invocados</h2>
        <div className="mt-2 divide-y divide-[var(--line)]">
          {history.map((replacement) => (
            <div
              className="grid grid-cols-[70px_minmax(0,.65fr)_minmax(0,1.35fr)_28px_28px] items-center gap-1.5 py-2 text-xs"
              key={replacement.id}
            >
              <span className="text-xs text-[var(--muted)]">{replacement.date}</span>
              <strong className="truncate">{doctorsById.get(replacement.doctorId)?.shortName}</strong>
              <span className="flex items-center justify-end gap-1 text-right">
                <small className="truncate text-[var(--muted)]">
                  {replacement.typeCode === "BASE"
                    ? "Punto Base"
                    : replacement.typeCode === "HERO"
                    ? "Histórico"
                    : getReplacementTypeLabel(replacement, types) ?? "Histórico"}
                </small>
                {replacement.mode === "invoked" ? (
                  <ReplacementStatus emoji="🪽" label="Invocado" />
                ) : null}
                {replacement.superhero ? (
                  <ReplacementStatus emoji="🦸" label="Superhéroe" />
                ) : null}
              </span>
              <strong className="text-right text-[var(--brand)]">+{replacement.points}</strong>
              <button
                aria-label={`Eliminar puntaje de ${doctorsById.get(replacement.doctorId)?.shortName ?? "médico"}`}
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] transition hover:bg-red-100 hover:text-red-700"
                onClick={() => removeReplacement(replacement)}
                title="Eliminar puntaje"
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <h2 className="text-sm font-semibold">Puntos Base</h2>
          <div className="mt-2 max-h-[520px] overflow-y-auto divide-y divide-[var(--line)]">
            {baseEntries.map((entry) => (
              <div className="grid grid-cols-[78px_minmax(0,1fr)_28px_28px] items-center gap-2 py-2 text-xs" key={entry.key}>
                <span className="text-[var(--muted)]">{entry.date}</span>
                <strong className="truncate">{doctorsById.get(entry.doctorId)?.shortName ?? entry.doctorId}</strong>
                <span className="font-semibold text-[var(--brand)]">+1</span>
                <button
                  aria-label={`Eliminar punto base de ${doctorsById.get(entry.doctorId)?.shortName ?? entry.doctorId} del ${entry.date}`}
                  className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-red-100 hover:text-red-700"
                  onClick={() => entry.assignmentId
                    ? void removeBase(entry.assignmentId)
                    : entry.replacement ? void removeReplacement(entry.replacement) : undefined}
                  title="Eliminar punto base"
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!baseEntries.length ? <p className="py-2 text-xs text-[var(--muted)]">Sin puntos base registrados.</p> : null}
          </div>
        </section>
        <AbsenceFreezeManager data={november} doctors={doctors} onUpdate={onNovemberUpdate} />
      </div>
    </div>
  );
}

export function ManagerHub({
  doctors,
  schedules,
  types,
  replacements,
  holidays,
  pearls,
  shiftColorLegend,
  shiftColorLegends,
  november,
}: {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  types: ReplacementType[];
  replacements: Replacement[];
  holidays: Holiday[];
  pearls: { current: string[]; future: string[] };
  shiftColorLegend: ShiftColorLegendItem[];
  shiftColorLegends?: Record<string, ShiftColorLegendItem[]>;
  november: NovemberData;
}) {
  const [tab, setTab] = useState<"schedule" | "scores" | "otros">("schedule");
  const [novemberData, setNovemberData] = useState(november);
  const reloadNovember = useCallback(async () => {
    const response = await fetch("/api/november", { cache: "no-store" });
    const result = await response.json() as NovemberData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "No fue posible actualizar el llamado");
    setNovemberData(result);
  }, []);
  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
            Acceso autorizado
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Jefe de Urgencias</h1>
        </div>
        <div className="flex flex-wrap justify-center justify-self-center rounded-xl bg-[var(--surface-soft)] p-0.5">
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
              tab === "schedule" && "bg-[var(--surface)] shadow-sm",
            )}
            onClick={() => setTab("schedule")}
            type="button"
          >
            <CalendarCheck size={16} /> Gestor de turnos
          </button>
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
              tab === "scores" && "bg-[var(--surface)] shadow-sm",
            )}
            onClick={() => setTab("scores")}
            type="button"
          >
            <UserRound size={16} /> Gestor de puntajes
          </button>
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
              tab === "otros" && "bg-[var(--surface)] shadow-sm",
            )}
            onClick={() => setTab("otros")}
            type="button"
          >
            <Star size={16} /> Otros
          </button>
        </div>
        <div className="hidden sm:block" />
      </div>
      {tab === "schedule" ? (
        <ScheduleManager
          initialColorLegend={shiftColorLegend}
          initialColorLegends={shiftColorLegends ?? {}}
          initialDoctors={doctors}
          schedules={schedules}
          onCallWeeks={novemberData.onCallWeeks}
          onOnCallSaved={reloadNovember}
        />
      ) : tab === "scores" ? (
        <ScoreManager
          doctors={doctors}
          schedules={schedules}
          holidays={holidays}
          recent={replacements}
          types={types}
          november={novemberData}
          onNovemberUpdate={setNovemberData}
        />
      ) : (
        <OtrosManager initialHolidays={holidays} initialPearls={pearls} />
      )}
    </div>
  );
}
