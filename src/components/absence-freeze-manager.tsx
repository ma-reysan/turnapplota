"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { NovemberData } from "@/lib/november-data";
import type { Doctor } from "@/lib/types";

export function AbsenceFreezeManager({ doctors, data, onUpdate }: {
  doctors: Doctor[];
  data: NovemberData;
  onUpdate: (data: NovemberData) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [freezeDoctorId, setFreezeDoctorId] = useState("");
  const [freezeStart, setFreezeStart] = useState("");
  const [freezeEnd, setFreezeEnd] = useState("");
  const activeDoctors = doctors.filter((doctor) => doctor.active);
  const doctorName = (id: string) => doctors.find((doctor) => doctor.id === id)?.shortName ?? id;
  const freezeDays = freezeStart && freezeEnd
    ? Math.round((Date.parse(`${freezeEnd}T12:00:00Z`) - Date.parse(`${freezeStart}T12:00:00Z`)) / 86_400_000) + 1
    : 0;

  async function save(action: object) {
    setBusy(true);
    try {
      const response = await fetch("/api/november", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible guardar");
      const refreshed = await fetch("/api/november", { cache: "no-store" });
      const next = await refreshed.json() as NovemberData & { error?: string };
      if (!refreshed.ok) throw new Error(next.error ?? "No fue posible actualizar los datos");
      onUpdate(next);
      toast.success("Cambios guardados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar");
    } finally {
      setBusy(false);
    }
  }

  const doctorOptions = activeDoctors.map((doctor) =>
    <option key={doctor.id} value={doctor.id}>{doctor.shortName}</option>);

  return <div className="space-y-3">
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <h2 className="text-sm font-semibold">Médicos con puntajes congelados</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">Pausa el vencimiento durante una ausencia de al menos 14 días.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-[var(--muted)] sm:col-span-2">Médico
          <select className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5 text-xs"
            onChange={(event) => setFreezeDoctorId(event.target.value)} value={freezeDoctorId}>
            <option value="">Seleccionar médico</option>{doctorOptions}
          </select>
        </label>
        <label className="text-xs text-[var(--muted)]">Desde
          <input className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5 text-xs"
            onChange={(event) => setFreezeStart(event.target.value)} type="date" value={freezeStart} />
        </label>
        <label className="text-xs text-[var(--muted)]">Hasta
          <input className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5 text-xs"
            min={freezeStart} onChange={(event) => setFreezeEnd(event.target.value)} type="date" value={freezeEnd} />
        </label>
      </div>
      <button className="mt-2 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        disabled={busy || !freezeDoctorId || freezeDays < 14}
        onClick={() => void save({ type: "freeze.add", freeze: {
          id: crypto.randomUUID(), doctorId: freezeDoctorId, startDate: freezeStart, endDate: freezeEnd,
        } })} type="button">Congelar puntajes</button>
      <div className="mt-3 divide-y divide-[var(--line)]">
        {data.freezes.map((item) => <div className="grid grid-cols-[minmax(70px,.65fr)_minmax(130px,1.35fr)_28px] items-center gap-2 py-2 text-xs" key={item.id}>
          <strong>{doctorName(item.doctorId)}</strong>
          <span className="text-[var(--muted)]">{item.startDate}–{item.endDate}</span>
          <button aria-label={`Eliminar congelamiento de ${doctorName(item.doctorId)}`}
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-red-100 hover:text-red-700"
            disabled={busy} onClick={() => void save({ type: "freeze.delete", id: item.id })} type="button"><Trash2 size={14} /></button>
        </div>)}
        {!data.freezes.length ? <p className="py-2 text-xs text-[var(--muted)]">Sin puntajes congelados.</p> : null}
      </div>
    </section>
  </div>;
}
