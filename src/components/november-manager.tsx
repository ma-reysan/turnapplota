"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { NovemberData } from "@/lib/november-data";
import type { Doctor, ScheduleMonth } from "@/lib/types";

type Action =
  | { type: "base.set"; assignmentId: string; worked: boolean; reason: string }
  | { type: "base.delete"; assignmentId: string };

export function NovemberManager({
  doctors, schedules, initial, onUpdate,
}: { doctors: Doctor[]; schedules: ScheduleMonth[]; initial: NovemberData; onUpdate: (data: NovemberData) => void }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [assignmentId, setAssignmentId] = useState("");
  const [worked, setWorked] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const assignments = schedules.filter((item) => item.id >= "2026-11" && item.status === "published")
    .flatMap((item) => item.assignments).sort((a, b) => b.date.localeCompare(a.date));

  async function reload() {
    const response = await fetch("/api/november", { cache: "no-store" });
    const body = await response.json() as NovemberData & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "No fue posible cargar el sistema de noviembre");
    setData(body);
    onUpdate(body);
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
        Los llamados se editan en el calendario de turnos. Los puntos base solo rigen para turnos iniciados desde esa fecha.
      </p>
      <button className="mt-2 rounded-lg border border-[var(--line)] px-2 py-1 text-xs" onClick={() => void reload()} type="button">
        Actualizar datos
      </button>
    </div>

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
