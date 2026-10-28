"use client";

import { useState } from "react";
import type { Doctor, ScheduleMonth } from "@/lib/types";

// Rejection sampling avoids the bias of taking a random integer modulo n.
export function randomParticipantIndex(count: number): number {
  if (!Number.isInteger(count) || count < 1 || count > 2 ** 32) throw new Error("Cantidad inválida");
  const limit = Math.floor(2 ** 32 / count) * count;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % count;
}

export function RaffleManager({ doctors, schedules }: { doctors: Doctor[]; schedules: ScheduleMonth[] }) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const published = schedules.filter((s) => s.year === year && s.month === month && s.status === "published");
  const latest = [...published].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
  const ids = new Set(latest?.assignments.filter((a) => a.date.startsWith(`${year}-${String(month).padStart(2, "0")}-`)).map((a) => a.doctorId));
  const eligible = doctors.filter((d) => d.active && ids.has(d.id)).sort((a, b) => a.sortOrder - b.sortOrder || a.longName.localeCompare(b.longName, "es"));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [winner, setWinner] = useState<Doctor | null>(null);
  const [error, setError] = useState("");
  const participants = eligible.filter((d) => !excluded.includes(d.id));
  const label = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", month: "long", year: "numeric" }).format(new Date());
  function draw() {
    if (!participants.length) return;
    try { setWinner(participants[randomParticipantIndex(participants.length)]); setError(""); }
    catch { setWinner(null); setError("No fue posible realizar el sorteo. Intenta nuevamente."); }
  }
  return <section className="space-y-4">
    <header><h2 className="text-xl font-semibold">Sorteos</h2><p className="text-sm text-[var(--muted)]">Médicos activos con turnos publicados en {label}.</p></header>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <fieldset className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <legend className="px-2 font-semibold">Participantes · {participants.length} de {eligible.length}</legend>
        <div className="mb-4 flex gap-3 text-sm">
          <button type="button" className="underline" onClick={() => { setExcluded([]); setWinner(null); }}>Seleccionar todos</button>
          <button type="button" className="underline" onClick={() => { setExcluded(eligible.map((d) => d.id)); setWinner(null); }}>Quitar todos</button>
        </div>
        <div className="grid grid-cols-2 gap-2">{eligible.map((doctor) => <label key={doctor.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-3 text-sm">
          <input type="checkbox" checked={!excluded.includes(doctor.id)} onChange={(e) => { setExcluded(e.target.checked ? excluded.filter((id) => id !== doctor.id) : [...excluded, doctor.id]); setWinner(null); }} />
          <span className="break-words">{doctor.longName}</span>
        </label>)}</div>
        {!eligible.length && <p className="text-sm text-[var(--muted)]">No hay médicos activos con turnos publicados este mes.</p>}
      </fieldset>
      <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center">
        <p className="text-sm text-[var(--muted)]">Cada participante tiene la misma probabilidad de salir. Puedes volver a sortear.</p>
        <button type="button" disabled={!participants.length} onClick={draw} className="rounded-xl bg-[var(--brand)] px-8 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Sortear</button>
        <div role="status" aria-live="polite" className="min-h-20">
          {winner ? <><p className="text-sm text-[var(--muted)]">Médico seleccionado</p><p className="mt-2 text-2xl font-semibold">{winner.longName}</p></> : <p className="text-sm text-[var(--muted)]">{participants.length ? "Listo para sortear" : "Selecciona al menos un participante"}</p>}
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  </section>;
}
