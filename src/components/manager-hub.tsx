"use client";

import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarCheck,
  Check,
  GripVertical,
  Plus,
  Save,
  Settings2,
  Star,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  Doctor,
  Replacement,
  ReplacementType,
  ScheduleMonth,
  ShiftAssignment,
  ShiftKind,
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
        "flex w-full items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-left transition",
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
  onAssign,
}: {
  date: string;
  kind: ShiftKind;
  slot: number;
  assignment?: ShiftAssignment;
  doctors: Doctor[];
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
          "h-[18px] w-full rounded border px-1 py-0 text-center text-[9px] font-bold uppercase leading-[18px] outline-none transition focus:ring-2 focus:ring-[var(--brand)] sm:text-[10px]",
          kind === "DAY"
            ? "border-[var(--day-border)] bg-[var(--day)]"
            : "border-[var(--night-border)] bg-[var(--night)]",
          isOver && "scale-105 ring-2 ring-[var(--brand)]",
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

  async function persist(doctor: Doctor) {
    onChange(doctors.map((item) => (item.id === doctor.id ? doctor : item)));
    const response = await fetch("/api/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doctor),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      toast.error(result.error ?? "No fue posible guardar el médico");
    } else {
      toast.success("Nómina actualizada");
    }
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
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <h3 className="text-sm font-semibold">Nómina dinámica</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Los inactivos se conservan en el historial, pero no aparecen al autocompletar.
      </p>
      <div className="mt-3 grid gap-1.5">
        {doctors.map((doctor) => (
          <div
            className={cn(
              "grid grid-cols-[1fr_90px_auto] gap-1.5 rounded-lg bg-[var(--surface-soft)] p-1.5",
              !doctor.active && "opacity-60",
            )}
            key={doctor.id}
          >
            <input
              aria-label={`Nombre largo de ${doctor.shortName}`}
              className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs"
              onBlur={(event) => persist({ ...doctor, longName: event.target.value.trim() })}
              defaultValue={doctor.longName}
            />
            <input
              aria-label={`Nombre corto de ${doctor.longName}`}
              className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs font-bold"
              onBlur={(event) =>
                persist({ ...doctor, shortName: normalizeDoctorSearch(event.target.value) })
              }
              defaultValue={doctor.shortName}
            />
            <button
              aria-label={doctor.active ? `Desactivar ${doctor.longName}` : `Activar ${doctor.longName}`}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg",
                doctor.active
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-[var(--surface)] text-[var(--muted)]",
              )}
              onClick={() => persist({ ...doctor, active: !doctor.active })}
              type="button"
            >
              {doctor.active ? <Check size={15} /> : <X size={15} />}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_90px_auto] gap-1.5">
        <input
          className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs"
          onChange={(event) => setNewLongName(event.target.value)}
          placeholder="Nombre largo"
          value={newLongName}
        />
        <input
          className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs"
          onChange={(event) => setNewShortName(event.target.value)}
          placeholder="CORTO"
          value={newShortName}
        />
        <button
          aria-label="Agregar médico"
          className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand)] text-white"
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
}: {
  initialDoctors: Doctor[];
  schedules: ScheduleMonth[];
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
  const schedule = sorted.find((item) => item.id === selectedId) ?? initialSchedule;
  const assignments = assignmentsByMonth[selectedId] ?? [];

  if (!schedule) return <p>No hay calendarios disponibles.</p>;

  function assign(date: string, kind: ShiftKind, slot: number, doctorId: string | null) {
    setAssignmentsByMonth((current) => {
      const withoutSlot = (current[selectedId] ?? []).filter(
        (item) => !(item.date === date && item.kind === kind && item.slot === slot),
      );
      const next = doctorId
        ? [
            ...withoutSlot,
            {
              id: `${selectedId}-${date}-${kind.toLowerCase()}-${slot}`,
              date,
              kind,
              slot,
              doctorId,
            },
          ]
        : withoutSlot;
      return { ...current, [selectedId]: next };
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const doctorId = String(event.active.id).replace("doctor:", "");
    const target = event.over ? String(event.over.id) : "";
    if (!target.startsWith("slot:")) return;
    const [, date, kind, slot] = target.split(":");
    assign(date, kind as ShiftKind, Number(slot), doctorId);
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

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="grid gap-3 xl:grid-cols-[minmax(680px,1fr)_230px]">
        <section className={cn("min-w-0 transition", editingRoster && "opacity-30")}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
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
            <div className="flex gap-2">
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
                      "min-h-[105px] rounded-lg border border-[var(--line)] p-1",
                      inMonth ? "bg-[var(--surface-soft)]" : "opacity-20",
                    )}
                    key={dateKey}
                  >
                    <span className="block text-right text-[9px] leading-3 text-[var(--muted)]">
                      {date.getDate()}
                    </span>
                    <div className="space-y-0.5">
                      {([1, 2, 3] as const).map((slot) => (
                        <EditableShiftCard
                          assignment={slots.get(`${dateKey}-DAY-${slot}`)}
                          date={dateKey}
                          doctors={doctors}
                          key={`day-${slot}-${slots.get(`${dateKey}-DAY-${slot}`)?.doctorId ?? "empty"}`}
                          kind="DAY"
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
        <aside className="space-y-2">
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
  const firstType = types[0];
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [doctorId, setDoctorId] = useState(doctors.find((doctor) => doctor.active)?.id ?? "");
  const [typeCode, setTypeCode] = useState(firstType?.code ?? "");
  const [points, setPoints] = useState(firstType?.defaultPoints ?? 0);
  const [mode, setMode] = useState<"voluntary" | "invoked">("voluntary");
  const doctorsById = new Map(doctors.map((doctor) => [doctor.id, doctor]));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/replacements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        date,
        doctorId,
        typeCode,
        points,
        mode,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) toast.error(result.error ?? "No fue posible guardar");
    else toast.success("Reemplazo guardado");
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <h2 className="text-sm font-semibold">Últimos reemplazos</h2>
        <div className="mt-2 divide-y divide-[var(--line)]">
          {recent.slice(0, 30).map((replacement) => (
            <div className="grid grid-cols-[90px_1fr_auto] gap-2 py-2 text-xs" key={replacement.id}>
              <span className="text-xs text-[var(--muted)]">{replacement.date}</span>
              <span>
                <strong>{doctorsById.get(replacement.doctorId)?.shortName}</strong>
                <small className="ml-2 text-[var(--muted)]">
                  {types.find((type) => type.code === replacement.typeCode)?.label ??
                    "Histórico"}
                </small>
              </span>
              <strong className="text-[var(--brand)]">+{replacement.points}</strong>
            </div>
          ))}
        </div>
      </section>
      <form
        className="self-start rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3"
        onSubmit={submit}
      >
        <div className="flex items-center gap-2">
          <Star size={18} className="text-[var(--brand)]" />
          <h2 className="font-semibold">Agregar reemplazo</h2>
        </div>
        <div className="mt-3 grid gap-2.5">
          <label className="text-xs text-[var(--muted)]">
            Fecha
            <input
              className="mt-1 block w-full rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
            />
          </label>
          <label className="text-xs text-[var(--muted)]">
            Médico
            <select
              className="mt-1 block w-full rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]"
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
              className="mt-1 block w-full rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const next = types.find((type) => type.code === event.target.value);
                setTypeCode(event.target.value);
                if (next) setPoints(next.defaultPoints);
              }}
              value={typeCode}
            >
              {types.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--muted)]">
              Modalidad
              <select
                className="mt-1 block w-full rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]"
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
                className="mt-1 block w-full rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]"
                max={20}
                min={0}
                onChange={(event) => setPoints(Number(event.target.value))}
                type="number"
                value={points}
              />
            </label>
          </div>
        </div>
        <button
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white"
          type="submit"
        >
          <Save size={16} /> Guardar item
        </button>
      </form>
    </div>
  );
}

export function ManagerHub({
  doctors,
  schedules,
  types,
  replacements,
}: {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  types: ReplacementType[];
  replacements: Replacement[];
}) {
  const [tab, setTab] = useState<"schedule" | "scores">("schedule");
  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
            Acceso autorizado
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Jefe de Urgencias</h1>
        </div>
        <div className="flex rounded-xl bg-[var(--surface-soft)] p-0.5">
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
        </div>
      </div>
      {tab === "schedule" ? (
        <ScheduleManager initialDoctors={doctors} schedules={schedules} />
      ) : (
        <ScoreManager doctors={doctors} recent={replacements} types={types} />
      )}
    </div>
  );
}
