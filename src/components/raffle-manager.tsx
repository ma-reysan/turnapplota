"use client";

import { useEffect, useRef, useState } from "react";
import type { Doctor } from "@/lib/types";

// Rejection sampling avoids the bias of taking a random integer modulo n.
export function randomParticipantIndex(count: number): number {
  if (!Number.isInteger(count) || count < 1 || count > 2 ** 32) throw new Error("Cantidad inválida");
  const limit = Math.floor(2 ** 32 / count) * count;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % count;
}

export function RaffleManager({ doctors }: { doctors: Doctor[] }) {
  const eligible = doctors.filter((d) => d.active).sort((a, b) => a.sortOrder - b.sortOrder || a.longName.localeCompare(b.longName, "es"));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [winner, setWinner] = useState<Doctor | null>(null);
  const [error, setError] = useState("");
  const [suspense, setSuspense] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) clearInterval(timer.current);
  }, []);
  const participants = eligible.filter((d) => !excluded.includes(d.id));
  function draw() {
    if (!participants.length || timer.current !== null) return;
    try {
      const selected = participants[randomParticipantIndex(participants.length)];
      setError("");
      setWinner(null);
      if (!suspense) { setWinner(selected); return; }
      let remaining = 3;
      setCountdown(remaining);
      timer.current = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) { setCountdown(remaining); return; }
        if (timer.current !== null) clearInterval(timer.current);
        timer.current = null;
        setCountdown(null);
        setWinner(selected);
      }, 1000);
    }
    catch { setWinner(null); setError("No fue posible realizar el sorteo. Intenta nuevamente."); }
  }
  return <section className="space-y-4">
    <header><h2 className="text-xl font-semibold">Sorteos</h2><p className="text-sm text-[var(--muted)]">Médicos activos del equipo.</p></header>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <fieldset disabled={countdown !== null} className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <legend className="px-2 font-semibold">Participantes · {participants.length} de {eligible.length}</legend>
        <div className="mb-4 flex gap-3 text-sm">
          <button type="button" className="underline" onClick={() => { setExcluded([]); setWinner(null); }}>Seleccionar todos</button>
          <button type="button" className="underline" onClick={() => { setExcluded(eligible.map((d) => d.id)); setWinner(null); }}>Quitar todos</button>
        </div>
        <div className="grid grid-cols-2 gap-2">{eligible.map((doctor) => <label key={doctor.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-3 text-sm">
          <input type="checkbox" checked={!excluded.includes(doctor.id)} onChange={(e) => { setExcluded(e.target.checked ? excluded.filter((id) => id !== doctor.id) : [...excluded, doctor.id]); setWinner(null); }} />
          <span className="break-words">{doctor.longName}</span>
        </label>)}</div>
        {!eligible.length && <p className="text-sm text-[var(--muted)]">No hay médicos activos en el equipo.</p>}
      </fieldset>
      <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center">
        <p className="text-sm text-[var(--muted)]">Cada participante tiene la misma probabilidad de salir. Puedes volver a sortear.</p>
        <button type="button" aria-pressed={suspense} disabled={countdown !== null} onClick={() => setSuspense((value) => !value)} className="rounded-lg px-2 py-1 text-xs text-[var(--muted)] ring-1 ring-[var(--line)] disabled:opacity-40">⏱ Suspenso 3 s: {suspense ? "activado" : "desactivado"}</button>
        <button type="button" disabled={!participants.length || countdown !== null} onClick={draw} className="rounded-xl bg-[var(--brand)] px-8 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{countdown !== null ? "Sorteando…" : "Sortear"}</button>
        <div role="status" aria-live="polite" className="relative min-h-20">
          {countdown !== null && <p className="text-4xl font-semibold tabular-nums" aria-label={`Cuenta regresiva: ${countdown}`}>{countdown}</p>}
          {winner && <span className="raffle-sparks" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ transform: `rotate(${i * 30}deg)` }}><b /></i>)}</span>}
          {winner ? <><p className="text-sm text-[var(--muted)]">Médico seleccionado</p><p className="mt-2 text-2xl font-semibold">{winner.longName}</p></> : countdown === null ? <p className="text-sm text-[var(--muted)]">{participants.length ? "Listo para sortear" : "Selecciona al menos un participante"}</p> : null}
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
    <style jsx>{`
      .raffle-sparks { position: absolute; width: 0; height: 0; left: 50%; top: 45%; pointer-events: none; }
      .raffle-sparks i { position: absolute; width: 0; height: 0; }
      .raffle-sparks b { display: block; width: 4px; height: 9px; border-radius: 3px; background: #d5a63e; opacity: 0; animation: raffle-spark 800ms ease-out both; }
      @keyframes raffle-spark { 0% { transform: translateY(-12px) scale(.4); opacity: 0; } 15% { opacity: .9; } 100% { transform: translateY(-95px) scale(.2); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { .raffle-sparks { display: none; } }
    `}</style>
  </section>;
}
