"use client";

import { useState } from "react";
import { toast } from "sonner";
import { availableFichas, santiagoParts, weekStart } from "@/lib/november-system";
import type { Doctor, Replacement, TokenAdjustment } from "@/lib/types";

export function TokenManager({ doctors, replacements, adjustments, onUpdate }: {
  doctors: Doctor[];
  replacements: Replacement[];
  adjustments: TokenAdjustment[];
  onUpdate: (items: TokenAdjustment[]) => void;
}) {
  const active = doctors.filter((doctor) => doctor.active);
  const [doctorId, setDoctorId] = useState(active[0]?.id ?? "");
  const [delta, setDelta] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const date = santiagoParts(new Date()).date;
  const monday = weekStart(date);
  const balance = availableFichas(replacements, doctorId, date, adjustments);
  const blocked = !doctorId || (delta === 1 ? balance === 2 : balance === 0);

  async function save() {
    if (busy || blocked) return;
    setBusy(true);
    try {
      const response = await fetch("/api/token-adjustments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: crypto.randomUUID(), doctorId, delta }),
      });
      const result = await response.json() as { error?: string; adjustments?: TokenAdjustment[] };
      if (!response.ok || !result.adjustments) throw new Error(result.error ?? "No fue posible guardar el ajuste");
      onUpdate(result.adjustments);
      toast.success(delta === 1 ? "Ficha añadida" : "Ficha restada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar el ajuste");
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
    <h2 className="text-sm font-semibold">Gestión de tokens</h2>
    <p className="mt-1 text-xs text-[var(--muted)]">Corrige las fichas de la semana actual ({monday}). Máximo 2 por médico.</p>
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="w-full text-xs text-[var(--muted)] sm:w-[180px]">Médico activo
        <select className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
          {active.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.shortName}</option>)}
        </select>
      </label>
      <div className="flex h-[31px] overflow-hidden rounded-lg border border-[var(--line)]" role="group" aria-label="Tipo de ajuste">
        {([[1, "Añadir"], [-1, "Restar"]] as const).map(([value, label]) => <button
          key={value} type="button" aria-pressed={delta === value} onClick={() => setDelta(value)}
          className={`px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 ${delta === value ? "bg-green-600 text-white" : "bg-[var(--surface-soft)] text-[var(--foreground)]"}`}>{label}</button>)}
      </div>
      <button type="button" disabled={busy || blocked} onClick={() => void save()}
        className="h-[31px] rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white disabled:opacity-50">Guardar ajuste</button>
      <span className="pb-1 text-xs text-[var(--muted)]">Disponibles: {balance ?? "—"}/2</span>
    </div>
    <h3 className="mt-4 text-xs font-semibold">Registro de ajustes manuales</h3>
    <div className="mt-1 max-h-48 overflow-y-auto divide-y divide-[var(--line)]">
      {adjustments.map((item) => <div key={item.id} className="flex items-center gap-2 py-1.5 text-xs">
        <time className="text-[var(--muted)]">{new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</time>
        <strong>{doctors.find((doctor) => doctor.id === item.doctorId)?.shortName ?? item.doctorId}</strong>
        <span className="text-[var(--muted)]">semana {item.weekStart}</span>
        <span className="ml-auto font-semibold">{item.delta > 0 ? "+1 añadida" : "−1 restada"}</span>
      </div>)}
      {!adjustments.length ? <p className="py-2 text-xs text-[var(--muted)]">Sin ajustes manuales.</p> : null}
    </div>
  </section>;
}
