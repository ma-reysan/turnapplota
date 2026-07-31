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
  GripVertical,
  Plus,
  Save,
  Settings2,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ReplacementStatus } from "@/components/replacement-status";
import { VacationManager } from "@/components/vacation-manager";
import type {
  Doctor,
  Holiday,
  Replacement,
  ReplacementType,
  ScheduleMonth,
  ShiftAssignment,
  ShiftKind,
  Vacation,
} from "@/lib/types";
import {
  calendarDays,
  cn,
  monthKey,
  monthLabel,
  normalizeDoctorSearch,
} from "@/lib/utils";

function DoctorDragCard({ doctor }: { doctor: Doctor }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `doctor:${doctor.id}`,
  });
  return (
    <button
      className={cn(
        "flex w-full items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-left transition-colors",
        isDragging && "opacity-40",
      )}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      type="button"
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
  doctors,
  laneHighlighted,
  onAssign,
}: {
  date: string;
  kind: ShiftKind;
  slot: number;
  assignment?: ShiftAssignment;
  doctors: Doctor[];
  laneHighlighted: boolean;
  onAssign: (doctorId: string | null) => void;
}) {
  const dropId = `slot:${date}:${kind}:${slot}`;
  const { isOver, setNodeRef } = useDroppable({ id: dropId });
  const assignedDoctor = doctors.find((doctor) => doctor.id === assignment?.doctorId);
  const [query, setQuery] = useState(assignedDoctor?.shortName ?? "");
  const [open, setOpen] = useState(false);
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
    <div className="relative" ref={setNodeRef}>
      <input
        aria-label={`${kind === "DAY" ? "Turno día" : "Turno noche"} ${slot}`}
        className={cn(
          "relative z-30 block h-[18px] w-full rounded border py-0 pl-1 pr-5 text-center text-[9px] font-bold uppercase leading-[18px] outline-none transition-[border-color,box-shadow] duration-150 focus:ring-2 focus:ring-[var(--brand)] sm:text-[10px]",
          kind === "DAY"
            ? "border-[var(--day-border)] bg-[var(--day)]"
            : "border-[var(--night-border)] bg-[var(--night)]",
          isOver && !laneHighlighted && "border-emerald-400 ring-2 ring-emerald-400",
          laneHighlighted && "border-purple-500 ring-2 ring-purple-500",
        )}
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
        placeholder="Escribir…"
        value={query}
      />
      {assignedDoctor ? (
        <button
          aria-label={`Quitar a ${assignedDoctor.shortName} del turno`}
          className="absolute right-0 top-0 z-40 grid h-[18px] w-4 place-items-center rounded-r text-[var(--foreground)]/45 transition hover:bg-black/10 hover:text-red-700"
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
      {open && suggestions.length ? (
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
    const id = normalizeDoctorSearch(newShortName).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (doctors.some((doctor) => doctor.id === id)) {
      toast.error("Ese nombre corto ya existe");
      return;
    }
    const doctor: Doctor = {
      id,
      longName: newLongName.trim(),
      shortName: normalizeDoctorSearch(newShortName),
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

function ScheduleManager({
  initialDoctors,
  schedules,
  vacations,
}: {
  initialDoctors: Doctor[];
  schedules: ScheduleMonth[];
  vacations: Vacation[];
}) {
  const sorted = useMemo(() => [...schedules].sort((a, b) => b.id.localeCompare(a.id)), [schedules]);
  const [selectedId, setSelectedId] = useState(sorted[0]?.id ?? "");
  const initialSchedule = sorted.find((schedule) => schedule.id === selectedId) ?? sorted[0];
  const [doctors, setDoctors] = useState(initialDoctors);
  const [assignmentsByMonth, setAssignmentsByMonth] = useState<Record<string, ShiftAssignment[]>>(
    () => Object.fromEntries(sorted.map((schedule) => [schedule.id, schedule.assignments])),
  );
  const [versions, setVersions] = useState<Record<string, number>>(
    () => Object.fromEntries(sorted.map((schedule) => [schedule.id, 1])),
  );
  const [editingRoster, setEditingRoster] = useState(false);
  const [laneMode, setLaneMode] = useState(false);
  const [draggedDoctorId, setDraggedDoctorId] = useState<string | null>(null);
  const [overSlotId, setOverSlotId] = useState<string | null>(null);
  const schedule = sorted.find((item) => item.id === selectedId) ?? initialSchedule;
  const assignments = assignmentsByMonth[selectedId] ?? [];

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
  }

  function assign(date: string, kind: ShiftKind, slot: number, doctorId: string | null) {
    assignToDates([date], kind, slot, doctorId);
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
    if (!target.startsWith("slot:")) return;
    const [, date, kind, slot] = target.split(":");
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

  async function save(publish: boolean) {
    const response = await fetch(`/api/schedules/${selectedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedId,
        version: versions[selectedId] ?? 1,
        publish,
        assignments,
      }),
    });
    const result = (await response.json()) as { error?: string; version?: number };
    if (!response.ok) {
      toast.error(result.error ?? "No fue posible guardar");
      return;
    }
    setVersions((current) => ({
      ...current,
      [selectedId]: result.version ?? current[selectedId],
    }));
    toast.success(publish ? "Mes publicado" : "Borrador guardado");
  }

  const slots = new Map(
    assignments.map((assignment) => [
      `${assignment.date}-${assignment.kind}-${assignment.slot}`,
      assignment,
    ]),
  );
  const lanePreview = new Set<string>();
  if (laneMode && draggedDoctorId && overSlotId) {
    const [, date, kind, slot] = overSlotId.split(":");
    laneDates(date).forEach((laneDate) => lanePreview.add(`${laneDate}-${kind}-${slot}`));
  }
  const vacationPreview = new Set<string>();
  if (draggedDoctorId) {
    for (const vacation of vacations.filter((item) => item.doctorId === draggedDoctorId)) {
      for (let cursor = new Date(`${vacation.startDate}T12:00:00`); cursor <= new Date(`${vacation.endDate}T12:00:00`); cursor = addDays(cursor, 1)) {
        vacationPreview.add(`${monthKey(cursor.getFullYear(), cursor.getMonth() + 1)}-${String(cursor.getDate()).padStart(2, "0")}`);
      }
    }
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
              <button
                className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium"
                onClick={() => save(false)}
                type="button"
              >
                <Save size={15} /> Guardar
              </button>
              <button
                className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-2.5 py-1.5 text-xs font-medium text-white"
                onClick={() => save(true)}
                type="button"
              >
                <CalendarCheck size={15} /> Publicar mes
              </button>
            </div>
          </div>
          <div className="scrollbar-subtle overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
            <div className="grid min-w-[680px] grid-cols-7 gap-1">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                <div className="pb-1 text-center text-[9px] font-semibold text-[var(--muted)]" key={day}>
                  {day}
                </div>
              ))}
              {calendarDays(schedule.year, schedule.month).map((date) => {
                const dateKey = `${monthKey(date.getFullYear(), date.getMonth() + 1)}-${String(date.getDate()).padStart(2, "0")}`;
                const inMonth = date.getMonth() + 1 === schedule.month;
                return (
                  <div
                    className={cn(
                      "relative min-h-[105px] rounded-lg border border-[var(--line)] p-1",
                      inMonth ? "bg-[var(--surface-soft)]" : "opacity-20",
                    )}
                    key={dateKey}
                  >
                    <span className="block text-right text-[9px] leading-3 text-[var(--muted)]">
                      {date.getDate()}
                    </span>
                    {vacationPreview.has(dateKey) ? <span className="pointer-events-none absolute inset-[-2px] z-20 rounded-lg border-2 border-sky-400 bg-sky-400/5 shadow-[0_0_0_1px_rgba(56,189,248,.25)] transition-opacity duration-150" /> : null}
                    <div className="space-y-0.5">
                      {([1, 2, 3] as const).map((slot) => (
                        <EditableShiftCard
                          assignment={slots.get(`${dateKey}-DAY-${slot}`)}
                          date={dateKey}
                          doctors={doctors}
                          key={`day-${slot}-${slots.get(`${dateKey}-DAY-${slot}`)?.doctorId ?? "empty"}`}
                          kind="DAY"
                          laneHighlighted={lanePreview.has(`${dateKey}-DAY-${slot}`)}
                          onAssign={(doctorId) => assign(dateKey, "DAY", slot, doctorId)}
                          slot={slot}
                        />
                      ))}
                      {([1, 2] as const).map((slot) => (
                        <EditableShiftCard
                          assignment={slots.get(`${dateKey}-NIGHT-${slot}`)}
                          date={dateKey}
                          doctors={doctors}
                          key={`night-${slot}-${slots.get(`${dateKey}-NIGHT-${slot}`)?.doctorId ?? "empty"}`}
                          kind="NIGHT"
                          laneHighlighted={lanePreview.has(`${dateKey}-NIGHT-${slot}`)}
                          onAssign={(doctorId) => assign(dateKey, "NIGHT", slot, doctorId)}
                          slot={slot}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-2">
              <p className="mb-2 text-[10px] text-[var(--muted)]">
                Arrastra o escribe directamente en una tarjeta.
              </p>
              <div className="grid gap-1">
                {doctors
                  .filter((doctor) => doctor.active)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((doctor) => (
                    <DoctorDragCard doctor={doctor} key={doctor.id} />
                  ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </DndContext>
  );
}

function ScoreManager({
  doctors,
  types,
  recent,
}: {
  doctors: Doctor[];
  types: ReplacementType[];
  recent: Replacement[];
}) {
  const formTypes = types.filter((type) => type.code !== "HERO");
  const firstType = formTypes[0];
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [doctorId, setDoctorId] = useState(doctors.find((doctor) => doctor.active)?.id ?? "");
  const [typeCode, setTypeCode] = useState(firstType?.code ?? "");
  const [points, setPoints] = useState(firstType?.defaultPoints ?? 0);
  const [mode, setMode] = useState<"voluntary" | "invoked">("voluntary");
  const [superhero, setSuperhero] = useState(false);
  const [history, setHistory] = useState(() =>
    [...recent].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15),
  );
  const doctorsById = new Map(doctors.map((doctor) => [doctor.id, doctor]));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const replacement = {
      id: crypto.randomUUID(),
      date,
      doctorId,
      typeCode,
      points,
      mode,
      superhero,
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
      setHistory((current) =>
        [replacement, ...current]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 15),
      );
      toast.success("Puntaje guardado");
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
    toast.success("Puntaje eliminado");
  }

  return (
    <div className="grid gap-3 xl:w-3/5 xl:min-w-[760px]">
      <form
        className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3"
        onSubmit={submit}
      >
        <div className="flex items-center gap-2">
          <Star size={17} className="text-[var(--brand)]" />
          <h2 className="text-sm font-semibold">Agregar puntaje nuevo</h2>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-[110px_minmax(135px,1fr)_minmax(145px,1.2fr)_105px_65px_118px_auto] xl:items-end">
          <label className="text-xs text-[var(--muted)]">
            Fecha
            <input
              className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
            />
          </label>
          <label className="text-xs text-[var(--muted)]">
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
          <label className="text-xs text-[var(--muted)]">
            Tipo
            <select
              className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
              onChange={(event) => {
                const next = formTypes.find((type) => type.code === event.target.value);
                setTypeCode(event.target.value);
                if (next) setPoints(next.defaultPoints + (superhero ? 1 : 0));
              }}
              value={typeCode}
            >
              {formTypes.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[var(--muted)]">
            Modalidad
            <select
              className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
              onChange={(event) => setMode(event.target.value as "voluntary" | "invoked")}
              value={mode}
            >
              <option value="voluntary">Voluntario</option>
              <option value="invoked">Invocado</option>
            </select>
          </label>
          <label className="text-xs text-[var(--muted)]">
            Puntos
            <input
              className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
              max={20}
              min={0}
              onChange={(event) => setPoints(Number(event.target.value))}
              type="number"
              value={points}
            />
          </label>
          <label className="flex h-[31px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 text-[10px] font-medium">
            <input
              checked={superhero}
              className="accent-purple-600"
              onChange={(event) => {
                setSuperhero(event.target.checked);
                setPoints((value) => Math.max(0, value + (event.target.checked ? 1 : -1)));
              }}
              type="checkbox"
            />
            🦸 Superhéroe
          </label>
          <button
            className="flex h-[31px] items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white md:col-span-2 xl:col-span-1"
            type="submit"
          >
            <Save size={14} /> Guardar
          </button>
        </div>
      </form>
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 xl:w-[72%] xl:min-w-[540px]">
        <h2 className="text-sm font-semibold">Últimos reemplazos</h2>
        <div className="mt-2 divide-y divide-[var(--line)]">
          {history.map((replacement) => (
            <div
              className="grid grid-cols-[78px_minmax(70px,.65fr)_minmax(120px,1.35fr)_40px_28px] items-center gap-2 py-2 text-xs"
              key={replacement.id}
            >
              <span className="text-xs text-[var(--muted)]">{replacement.date}</span>
              <strong>{doctorsById.get(replacement.doctorId)?.shortName}</strong>
              <span className="flex items-center justify-end gap-1 text-right">
                <small className="truncate text-[var(--muted)]">
                  {replacement.typeCode === "HERO"
                    ? "Histórico"
                    : types.find((type) => type.code === replacement.typeCode)?.label ??
                      "Histórico"}
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
    </div>
  );
}

export function ManagerHub({
  doctors,
  schedules,
  types,
  replacements,
  vacations,
  holidays,
}: {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  types: ReplacementType[];
  replacements: Replacement[];
  vacations: Vacation[];
  holidays: Holiday[];
}) {
  const [tab, setTab] = useState<"schedule" | "scores" | "vacations">("schedule");
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
              tab === "vacations" && "bg-[var(--surface)] shadow-sm",
            )}
            onClick={() => setTab("vacations")}
            type="button"
          >
            <Star size={16} /> Vacaciones
          </button>
        </div>
        <div className="hidden sm:block" />
      </div>
      {tab === "schedule" ? (
        <ScheduleManager initialDoctors={doctors} schedules={schedules} vacations={vacations} />
      ) : tab === "scores" ? (
        <ScoreManager doctors={doctors} recent={replacements} types={types} />
      ) : (
        <VacationManager doctors={doctors} initialHolidays={holidays} initialVacations={vacations} />
      )}
    </div>
  );
}
