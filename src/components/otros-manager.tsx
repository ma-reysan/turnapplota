"use client";

import { BookOpen, CalendarOff, Palette, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ACCENT_THEME_OPTIONS, isAccentTheme, type AccentTheme } from "@/lib/accent-theme";
import type { Holiday } from "@/lib/types";

function chileDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatHolidayDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function OtrosManager({ initialHolidays, initialPearls }: { initialHolidays: Holiday[]; initialPearls: { current: string[]; future: string[] } }) {
  const router = useRouter();
  const [holidays, setHolidays] = useState(() =>
    [...initialHolidays].sort((a, b) => a.date.localeCompare(b.date)),
  );
  const [holidayDate, setHolidayDate] = useState(chileDateKey());
  const [holidayLabel, setHolidayLabel] = useState("");
  const [pearlVersion, setPearlVersion] = useState<"current" | "future">("current");
  const [pearlDrafts, setPearlDrafts] = useState(initialPearls);
  const [savingPearls, setSavingPearls] = useState(false);
  const [accentTheme, setAccentTheme] = useState<AccentTheme>("green");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("turnapp:accent-theme");
    const theme = isAccentTheme(savedTheme) ? savedTheme : "green";
    const timer = window.setTimeout(() => {
      setAccentTheme(theme);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function changeAccentTheme(theme: AccentTheme) {
    setAccentTheme(theme);
    window.localStorage.setItem("turnapp:accent-theme", theme);
    window.dispatchEvent(new Event("turnapp:accent-theme-change"));
    toast.success(`Tema ${ACCENT_THEME_OPTIONS.find((option) => option.value === theme)?.label ?? theme} guardado`);
  }
  const { nextHolidays, yearHolidays } = useMemo(() => {
    const today = chileDateKey();
    const horizon = new Date(`${today}T12:00:00`);
    horizon.setDate(horizon.getDate() + 365);
    const limit = chileDateKey(horizon);
    const upcoming = [...holidays]
      .filter((holiday) => holiday.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      nextHolidays: upcoming.slice(0, 4),
      yearHolidays: upcoming.filter((holiday) => holiday.date <= limit),
    };
  }, [holidays]);

  async function savePearls(event: React.FormEvent) {
    event.preventDefault();
    const lines = pearlDrafts[pearlVersion].map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return toast.error("Añade al menos una perla");
    setSavingPearls(true);
    try {
      const response = await fetch("/api/pearls", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: pearlVersion, lines }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No fue posible guardar las perlas");
      setPearlDrafts((current) => ({ ...current, [pearlVersion]: lines }));
      router.refresh();
      toast.success("Perlas guardadas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar las perlas");
    } finally {
      setSavingPearls(false);
    }
  }

  async function saveHoliday(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: holidayDate,
        label: holidayLabel || undefined,
      }),
    });
    const result = (await response.json()) as {
      holiday?: Holiday;
      error?: string;
    };
    if (!response.ok || !result.holiday)
      return toast.error(result.error ?? "No fue posible guardar el feriado");
    setHolidays((current) =>
      [
        ...current.filter((item) => item.date !== result.holiday!.date),
        result.holiday!,
      ].sort((a, b) => a.date.localeCompare(b.date)),
    );
    router.refresh();
    setHolidayLabel("");
    toast.success("Feriado guardado");
  }

  async function removeHoliday(date: string) {
    const response = await fetch("/api/holidays", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    if (!response.ok) return toast.error("No fue posible eliminar el feriado");
    setHolidays((current) => current.filter((item) => item.date !== date));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <section className="mb-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="flex items-center gap-2">
          <Palette size={17} className="text-[var(--brand)]" />
          <div>
            <h2 className="text-sm font-semibold">Temática</h2>
            <p className="text-[11px] text-[var(--muted)]">
              Se aplica a toda la aplicación y mantiene el modo claro u oscuro.
            </p>
          </div>
        </div>
        <label className="mt-3 block text-xs font-medium" htmlFor="accent-theme">
          Color principal
        </label>
        <select
          className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-2 text-xs"
          id="accent-theme"
          onChange={(event) => changeAccentTheme(event.target.value as AccentTheme)}
          value={accentTheme}
        >
          {ACCENT_THEME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>
      <section className="mb-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="flex items-center gap-2">
          <BookOpen size={17} className="text-[var(--brand)]" />
          <h2 className="text-sm font-semibold">Editor de Perlas</h2>
        </div>
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          Edita cada instrucción por separado. Las perlas futuras se mostrarán automáticamente desde el 1 de noviembre de 2026.
        </p>
        <div className="mt-3 flex gap-2" aria-label="Versión de perlas">
          {(["current", "future"] as const).map((version) => (
            <button
              key={version}
              type="button"
              aria-pressed={pearlVersion === version}
              className={`rounded-lg border px-3 py-2 text-xs ${pearlVersion === version ? "border-[var(--brand)] bg-[var(--surface-soft)] font-semibold" : "border-[var(--line)]"}`}
              onClick={() => setPearlVersion(version)}
            >
              {version === "current" ? "Actuales" : "Desde el 1 de noviembre"}
            </button>
          ))}
        </div>
        <form className="mt-3 space-y-2" onSubmit={savePearls}>
          {pearlDrafts[pearlVersion].map((line, index) => (
            <div className="flex gap-2" key={index}>
              <label className="sr-only" htmlFor={`pearl-${pearlVersion}-${index}`}>Perla {index + 1}</label>
              <textarea
                id={`pearl-${pearlVersion}-${index}`}
                className="min-h-16 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-2 text-xs"
                value={line}
                maxLength={1000}
                onChange={(event) => setPearlDrafts((current) => ({
                  ...current,
                  [pearlVersion]: current[pearlVersion].map((item, i) => i === index ? event.target.value : item),
                }))}
              />
              <button
                type="button"
                aria-label={`Eliminar perla ${index + 1}`}
                className="self-start rounded-lg border border-[var(--line)] p-2"
                onClick={() => setPearlDrafts((current) => ({
                  ...current,
                  [pearlVersion]: current[pearlVersion].filter((_, i) => i !== index),
                }))}
              ><Trash2 size={15} /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs" onClick={() => setPearlDrafts((current) => ({
              ...current, [pearlVersion]: [...current[pearlVersion], ""],
            }))}>Añadir perla</button>
            <button type="submit" disabled={savingPearls} className="rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {savingPearls ? "Guardando…" : "Guardar perlas"}
            </button>
          </div>
        </form>
      </section>
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="flex items-center gap-2">
          <CalendarOff size={17} className="text-amber-600" />
          <h2 className="text-sm font-semibold">Feriados</h2>
        </div>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={saveHoliday}
        >
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs"
            type="date"
            value={holidayDate}
            onChange={(event) => setHolidayDate(event.target.value)}
          />
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs"
            placeholder="Nombre opcional"
            value={holidayLabel}
            onChange={(event) => setHolidayLabel(event.target.value)}
          />
          <button
            className="rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white"
            type="submit"
          >
            Guardar
          </button>
        </form>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Calendario oficial de Chile y días especiales agregados por el equipo.
        </p>
        <div className="mt-3 border-b border-[var(--line)] pb-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold">Próximos feriados</h3>
            <span className="text-[11px] text-[var(--muted)]">Desde hoy</span>
          </div>
          {nextHolidays.length ? (
            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {nextHolidays.map((item) => (
                <div
                  className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-xs"
                  key={item.date}
                >
                  <strong className="block text-[var(--foreground)]">
                    {formatHolidayDate(item.date)}
                  </strong>
                  <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
                    {item.label || "Feriado"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-xs text-[var(--muted)]">
              No hay feriados próximos.
            </p>
          )}
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold">Próximos 365 días</h3>
            <span className="text-[11px] text-[var(--muted)]">
              {yearHolidays.length} fechas
            </span>
          </div>
          <div className="divide-y divide-[var(--line)]">
          {yearHolidays.length ? (
            yearHolidays.map((item) => (
              <div
                className="flex items-center justify-between gap-2 py-2 text-xs"
                key={item.date}
              >
                <span>
                  <strong>{formatHolidayDate(item.date)}</strong>
                  {item.label ? (
                    <small className="ml-2 text-[var(--muted)]">
                      {item.label}
                    </small>
                  ) : null}
                </span>
                <button
                  aria-label="Eliminar feriado"
                  className="rounded p-1 text-[var(--muted)] hover:bg-red-100 hover:text-red-700"
                  onClick={() => removeHoliday(item.date)}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <p className="py-5 text-center text-xs text-[var(--muted)]">
              No hay feriados durante los próximos 365 días.
            </p>
          )}
          </div>
        </div>
      </section>
    </div>
  );
}
