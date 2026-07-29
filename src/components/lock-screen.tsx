"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LockScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const result = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(result.error ?? "No fue posible ingresar");
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid min-h-[72vh] place-items-center">
      <form
        className="glass w-full max-w-md rounded-[2rem] p-7 sm:p-10"
        onSubmit={unlock}
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--brand)] text-white">
          <ShieldCheck size={27} />
        </span>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
          Acceso restringido
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Jefe de Urgencias</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Ingresa la clave para administrar turnos, médicos y puntajes.
        </p>
        <label className="mt-8 block">
          <span className="mb-2 block text-xs font-medium text-[var(--muted)]">Clave</span>
          <span className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 focus-within:ring-2 focus-within:ring-[var(--brand)]">
            <KeyRound size={18} className="text-[var(--muted)]" />
            <input
              autoComplete="current-password"
              className="w-full bg-transparent py-3.5 outline-none"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </span>
        </label>
        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
        <button
          className="mt-5 w-full rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white disabled:opacity-50"
          disabled={pending || !password}
          type="submit"
        >
          {pending ? "Verificando…" : "Desbloquear"}
        </button>
      </form>
    </div>
  );
}
