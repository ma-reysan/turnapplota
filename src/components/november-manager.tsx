"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { NovemberData } from "@/lib/november-data";
import { NEW_SYSTEM_START, weekStart } from "@/lib/november-system";
import type { Doctor, ScheduleMonth } from "@/lib/types";

type Action =
  | { type: "oncall.set"; weekStart: string; doctorIds: string[] }
  | { type: "absence.add"; absence: { id: string; doctorId: string; startDate: string; endDate: string;
      reason: "licencia" | "vacaciones" | "pasantia" | "otro" } }
  | { type: "absence.delete"; id: string }
  | { type: "freeze.add"; freeze: { id: string; doctorId: string; startDate: string; endDate: string } }
  | { type: "freeze.delete"; id: string }
  | { type: "base.set"; assignmentId: string; worked: boolean; reason: string }
  | { type: "base.delete"; assignmentId: string }
  | { type: "doctor.conditions"; doctorId: string; onlyVolunteer: boolean;
      allowDay: boolean; allowNight: boolean; allowFridaySaturday24: boolean };

function doctorConditions(doctor: Doctor) {
  return {
    onlyVolunteer: Boolean(doctor.onlyVolunteer),
    allowDay: doctor.allowDay ?? true,
    allowNight: doctor.allowNight ?? true,
    allowFridaySaturday24: Boolean(doctor.allowFridaySaturday24),
  };
}

export function NovemberManager({
  doctors, schedules, initial,
}: { doctors: Doctor[]; schedules: ScheduleMonth[]; initial: NovemberData }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [doctorId, setDoctorId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState<"licencia" | "vacaciones" | "pasantia" | "otro">("licencia");
  const [assignmentId, setAssignmentId] = useState("");
  const [worked, setWorked] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [weekEdits, setWeekEdits] = useState<Record<string, string[]>>({});
  const [conditionDoctors, setConditionDoctors] = useState(doctors);
  const [conditionDrafts, setConditionDrafts] = useState<Record<string, ReturnType<typeof doctorConditions>>>(
    () => Object.fromEntries(doctors.map((doctor) => [doctor.id, doctorConditions(doctor)])),
  );
  const activeDoctors = conditionDoctors.filter((doctor) => doctor.active)
    .sort((a, b) => a.shortName.localeCompare(b.shortName, "es-CL"));
  const assignments = schedules.filter((item) => item.id >= "2026-11" && item.status === "published")
    .flatMap((item) => item.assignments).sort((a, b) => b.date.localeCompare(a.date));

  async function reload() {
    const response = await fetch("/api/november", { cache: "no-store" });
    const body = await response.json() as NovemberData & { doctors: Doctor[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? "No fue posible cargar el sistema de noviembre");
    setData(body);
    setConditionDoctors(body.doctors);
    setConditionDrafts(Object.fromEntries(body.doctors.map((doctor) => [doctor.id, doctorConditions(doctor)])));
  }
  async function save(action: Action) {
    setBusy(true);
    try {
      const response = await fetch("/api/november", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No fue posible guardar");
      await reload();
      toast.success("Cambios guardados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-3">
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <h2 className="text-sm font-semibold">Sistema desde el 1 de noviembre de 2026</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Puedes preparar el llamado de noviembre ahora. Los llamados y puntos base solo rigen para turnos iniciados desde esa fecha.
      </p>
      <button className="mt-2 rounded-lg border border-[var(--line)] px-2 py-1 text-xs" onClick={() => void reload()} type="button">
        Actualizar datos
      </button>
    </div>

    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <h3 className="text-sm font-semibold">Condiciones autorizadas del equipo</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">Quien figura solo como voluntario no integra el trío de llamado.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {activeDoctors.map((doctor) => {
          const draft = conditionDrafts[doctor.id] ?? doctorConditions(doctor);
          return <div className="rounded-lg border border-[var(--line)] p-2 text-xs" key={doctor.id}>
            <strong>{doctor.shortName}</strong>
            <div className="mt-1 flex flex-wrap gap-2">
              {([
                ["onlyVolunteer", "Solo voluntariado"],
                ["allowDay", "Día"],
                ["allowNight", "Noche"],
                ["allowFridaySaturday24", "24 h viernes/sábado"],
              ] as const).map(([key, label]) => <label className="flex items-center gap-1" key={key}>
                <input checked={draft[key]} onChange={(event) => setConditionDrafts((current) => ({
                  ...current, [doctor.id]: { ...draft, [key]: event.target.checked },
                }))} type="checkbox" /> {label}
              </label>)}
            </div>
            <button className="mt-2 rounded-lg border border-[var(--line)] px-2 py-1 font-semibold disabled:opacity-50"
              disabled={busy} onClick={() => void save({ type: "doctor.conditions", doctorId: doctor.id, ...draft })}
              type="button">Guardar condiciones</button>
          </div>;
        })}
      </div>
    </section>

    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <h3 className="text-sm font-semibold">Médicos de llamado por semana</h3>
      <div className="mt-2 space-y-2">
        {data.onCallWeeks.filter((item) => item.weekStart >= weekStart(NEW_SYSTEM_START)).map((week) => {
          const selected = weekEdits[week.weekStart] ?? week.doctorIds;
          return <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2" key={week.weekStart}>
            <span className="w-28 text-xs font-semibold">{week.weekStart}</span>
            {selected.map((value, index) => <select aria-label={`Llamado ${index + 1} de la semana ${week.weekStart}`}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1 text-xs"
              key={index} onChange={(event) => setWeekEdits((current) => ({
                ...current, [week.weekStart]: selected.map((doctor, slot) => slot === index ? event.target.value : doctor),
              }))} value={value}>
              {activeDoctors.filter((doctor) => !doctor.onlyVolunteer).map((doctor) =>
                <option key={doctor.id} value={doctor.id}>{doctor.shortName}</option>)}
            </select>)}
            <button className="rounded-lg bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
              disabled={busy || new Set(selected).size !== 3}
              onClick={() => void save({ type: "oncall.set", weekStart: week.weekStart, doctorIds: selected })}
              type="button">Guardar</button>
            {week.needsReview ? <span className="text-xs font-semibold text-amber-700">Revisar cambios de turnos o ausencia</span> : null}
          </div>;
        })}
        {!data.onCallWeeks.length ? <p className="text-xs text-[var(--muted)]">Publica un mes desde noviembre para preparar su llamado.</p> : null}
      </div>
    </section>

    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <h3 className="text-sm font-semibold">Ausencias registradas</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">Un turno propio coincidente no suma punto base automáticamente.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <select aria-label="Médico de la ausencia" className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-1 text-xs"
          onChange={(event) => setDoctorId(event.target.value)} value={doctorId}>
          <option value="">Médico</option>
          {activeDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.shortName}</option>)}
        </select>
        <input aria-label="Inicio de ausencia" className="rounded-lg border border-[var(--line)] p-1 text-xs"
          onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
        <input aria-label="Fin de ausencia" className="rounded-lg border border-[var(--line)] p-1 text-xs"
          min={startDate} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        <select aria-label="Motivo de ausencia" className="rounded-lg border border-[var(--line)] p-1 text-xs"
          onChange={(event) => setReason(event.target.value as typeof reason)} value={reason}>
          <option value="licencia">Licencia</option><option value="vacaciones">Vacaciones</option>
          <option value="pasantia">Pasantía</option><option value="otro">Otro</option>
        </select>
        <button className="rounded-lg bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          disabled={busy || !doctorId || !startDate || endDate < startDate}
          onClick={() => void save({ type: "absence.add", absence: {
            id: crypto.randomUUID(), doctorId, startDate, endDate, reason,
          } })} type="button">Registrar ausencia</button>
      </div>
      <div className="mt-2 space-y-1">
        {data.absences.map((item) => <div className="flex flex-wrap items-center gap-2 text-xs" key={item.id}>
          <span>{doctors.find((doctor) => doctor.id === item.doctorId)?.shortName ?? item.doctorId}: {item.startDate}–{item.endDate} · {item.reason}</span>
          <button className="text-[var(--danger)]" disabled={busy} onClick={() => void save({ type: "absence.delete", id: item.id })} type="button">Eliminar</button>
        </div>)}
      </div>
    </section>

    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <h3 className="text-sm font-semibold">Pausas de vencimiento</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">Selecciona médico e intervalo de al menos 14 días en los campos anteriores.</p>
      <button className="mt-2 rounded-lg bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
        disabled={busy || !doctorId || !startDate || !endDate}
        onClick={() => void save({ type: "freeze.add", freeze: {
          id: crypto.randomUUID(), doctorId, startDate, endDate,
        } })} type="button">Pausar vencimiento</button>
      <div className="mt-2 space-y-1">
        {data.freezes.map((item) => <div className="flex flex-wrap items-center gap-2 text-xs" key={item.id}>
          <span>{doctors.find((doctor) => doctor.id === item.doctorId)?.shortName ?? item.doctorId}: {item.startDate}–{item.endDate}</span>
          <button className="text-[var(--danger)]" disabled={busy} onClick={() => void save({ type: "freeze.delete", id: item.id })} type="button">Eliminar</button>
        </div>)}
      </div>
    </section>

    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <h3 className="text-sm font-semibold">Corrección de punto base</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select aria-label="Turno propio a corregir" className="max-w-full rounded-lg border border-[var(--line)] p-1 text-xs"
          onChange={(event) => setAssignmentId(event.target.value)} value={assignmentId}>
          <option value="">Seleccionar turno publicado desde noviembre</option>
          {assignments.map((item) => <option key={item.id} value={item.id}>
            {item.date} {item.kind === "DAY" ? "día" : "noche"} · {doctors.find((doctor) => doctor.id === item.doctorId)?.shortName ?? item.doctorId}
          </option>)}
        </select>
        <label className="text-xs"><input checked={worked} onChange={(event) => setWorked(event.target.checked)} type="checkbox" /> Sí se trabajó</label>
        <input aria-label="Motivo de corrección" className="rounded-lg border border-[var(--line)] p-1 text-xs"
          onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Motivo" value={correctionReason} />
        <button className="rounded-lg bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          disabled={busy || !assignmentId || correctionReason.trim().length < 3}
          onClick={() => void save({ type: "base.set", assignmentId, worked, reason: correctionReason })}
          type="button">Guardar corrección</button>
      </div>
      <div className="mt-2 space-y-1">
        {data.corrections.map((item) => <div className="flex flex-wrap items-center gap-2 text-xs" key={item.assignmentId}>
          <span>{item.assignmentId}: {item.worked ? "Trabajado" : "No trabajado"} · {item.reason}</span>
          <button className="text-[var(--danger)]" disabled={busy}
            onClick={() => void save({ type: "base.delete", assignmentId: item.assignmentId })} type="button">Eliminar</button>
        </div>)}
      </div>
    </section>
  </div>;
}
