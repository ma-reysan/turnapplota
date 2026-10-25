"use client";

import { BookOpen, CalendarOff, Palette, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ACCENT_THEME_OPTIONS, type ThemeChoice } from "@/lib/accent-theme";
import { useAccentTheme } from "@/components/accent-theme-provider";
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

const PEARL_CATEGORIES = ["Perlas", "Puntos", "Superhéroe", "Comodín de Apoyo", "Tabla", "Descanso", "Fichas", "Médicos de Llamado", "Puntos base", "Puntos por reemplazo"] as const;
type PearlGroups = Record<string, string[]>;

function groupPearlLines(lines: string[]): PearlGroups {
  const groups: PearlGroups = {};
  let current = "Perlas";
  for (const line of lines) {
    const heading = PEARL_CATEGORIES.find((category) =>
      line.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z]/gi, "").toLowerCase() ===
      category.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z]/gi, "").toLowerCase());
    if (heading) {
      current = heading;
      groups[current] ??= [];
    } else {
      (groups[current] ??= []).push(line);
    }
  }
  return groups;
}

function flattenPearlGroups(groups: PearlGroups): string[] {
  return PEARL_CATEGORIES.flatMap((category) => {
    const lines = groups[category]?.map((line) => line.trim()).filter(Boolean) ?? [];
    return lines.length ? [category + ":", ...lines] : [];
  });
}

export function OtrosManager({ initialHolidays, initialPearls }: { initialHolidays: Holiday[]; initialPearls: { current: string[]; future: string[] } }) {
  const router = useRouter();
  const [holidays, setHolidays] = useState(() =>
    [...initialHolidays].sort((a, b) => a.date.localeCompare(b.date)),
  );
  const [holidayDate, setHolidayDate] = useState(chileDateKey());
  const [holidayLabel, setHolidayLabel] = useState("");
  const [showYearHolidays, setShowYearHolidays] = useState(false);
  const [pearlVersion, setPearlVersion] = useState<"current" | "future">("current");
  const [pearlDrafts, setPearlDrafts] = useState(() => ({ current: groupPearlLines(initialPearls.current), future: groupPearlLines(initialPearls.future) }));
  const [editorOpen, setEditorOpen] = useState(false);
  const [savingPearls, setSavingPearls] = useState(false);
  const appearance = useAccentTheme();
  const themeLabel = (theme: ThemeChoice) => theme === "auto" ? "Automático (tema de temporada)" : ACCENT_THEME_OPTIONS.find((option) => option.value === theme)?.label;

  async function publishTheme() {
    try {
      await appearance.publish();
      toast.success("Tema publicado para todos los usuarios");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo publicar el tema");
    }
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
    const lines = flattenPearlGroups(pearlDrafts[pearlVersion]);
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
      setPearlDrafts((current) => ({ ...current, [pearlVersion]: groupPearlLines(lines) }));
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
              Al seleccionar un tema lo ves inmediatamente solo en este navegador. Pulsa «Publicar para todos» para activar ese tema para todos los usuarios.
            </p>
          </div>
        </div>
        <label className="mt-3 block text-xs font-medium" htmlFor="accent-theme">
          Color principal
        </label>
        <select
          className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-2 text-xs"
          id="accent-theme"
          onChange={(event) => appearance.select(event.target.value as ThemeChoice)}
          value={appearance.selected}
          disabled={!appearance.loaded || appearance.publishing}
        >
          <option value="auto">Automático (tema de temporada)</option>
          {ACCENT_THEME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] text-[var(--muted)]" role="status">
          Publicado para todos: {themeLabel(appearance.published)}.
          {appearance.localPreview ? " Estás viendo una prueba local sin publicar." : " Estás viendo el tema publicado."}
        </p>
        {appearance.error ? <p role="alert" className="mt-2 text-xs text-[var(--danger)]">{appearance.error}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs disabled:opacity-50"
            onClick={appearance.discard} disabled={!appearance.localPreview || appearance.publishing}>
            Volver al tema publicado
          </button>
          <button type="button" className="rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            onClick={() => void publishTheme()} disabled={!appearance.loaded || appearance.publishing || !appearance.localPreview}>
            {appearance.publishing ? "Publicando…" : "Publicar para todos"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--muted)]">Al publicar, los navegadores abiertos adoptan el tema en hasta 30 segundos o al volver a la aplicación. Se conserva el modo claro u oscuro.</p>
      </section>
      <section className="mb-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><BookOpen size={17} className="text-[var(--brand)]" /> Editor de Perlas</h2>
          <button type="button" aria-expanded={editorOpen} aria-controls="pearl-editor" onClick={() => setEditorOpen((open) => !open)}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium">
            {editorOpen ? "Cerrar editor" : "Abrir editor"}
          </button>
        </div>
        {editorOpen && <div id="pearl-editor">
          <p className="mt-2 text-[11px] text-[var(--muted)]">Las perlas futuras se mostrarán desde el 1 de noviembre de 2026.</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Versión de perlas">
            {(["current", "future"] as const).map((version) => (
              <button key={version} type="button" aria-pressed={pearlVersion === version}
                className={`rounded-lg border px-3 py-2 text-xs ${pearlVersion === version ? "border-[var(--brand)] bg-[var(--surface-soft)] font-semibold" : "border-[var(--line)]"}`}
                onClick={() => setPearlVersion(version)}>{version === "current" ? "Actuales" : "Desde el 1 de noviembre"}</button>
            ))}
          </div>
          <form className="mt-3 space-y-3" onSubmit={savePearls}>
            {PEARL_CATEGORIES.filter((category) => pearlVersion === "current"
              ? ["Perlas", "Puntos", "Superhéroe", "Comodín de Apoyo"].includes(category)
                || (pearlDrafts.current[category]?.length ?? 0) > 0
              : true).map((category) => (
              <fieldset key={category} className="rounded-xl border border-[var(--line)] p-2.5">
                <legend className="px-1 text-xs font-semibold text-[var(--brand)]">{category}</legend>
                <div className="space-y-1.5">
                  {(pearlDrafts[pearlVersion][category] ?? []).map((line, index) => (
                    <div className="flex items-start gap-1.5" key={index}>
                      <label className="sr-only" htmlFor={`pearl-${pearlVersion}-${category}-${index}`}>{category}, perla {index + 1}</label>
                      <textarea id={`pearl-${pearlVersion}-${category}-${index}`} rows={1} maxLength={1000}
                        ref={(node) => { if (node) { node.style.height = "auto"; node.style.height = `${node.scrollHeight}px`; } }}
                        className="min-h-9 w-full resize-none overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5 text-xs leading-5"
                        value={line} onChange={(event) => setPearlDrafts((current) => ({
                          ...current, [pearlVersion]: { ...current[pearlVersion], [category]:
                            (current[pearlVersion][category] ?? []).map((item, i) => i === index ? event.target.value : item) },
                        }))} />
                      <button type="button" aria-label={`Eliminar perla ${index + 1} de ${category}`}
                        className="shrink-0 p-1 text-[var(--muted)] hover:text-[var(--danger)]"
                        onClick={() => setPearlDrafts((current) => ({
                          ...current, [pearlVersion]: { ...current[pearlVersion], [category]:
                            (current[pearlVersion][category] ?? []).filter((_, i) => i !== index) },
                        }))}><X size={14} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" className="mt-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[11px]"
                  onClick={() => setPearlDrafts((current) => ({
                    ...current, [pearlVersion]: { ...current[pearlVersion], [category]:
                      [...(current[pearlVersion][category] ?? []), ""] },
                  }))}>+ Añadir perla</button>
              </fieldset>
            ))}
            <button type="submit" disabled={savingPearls} className="rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {savingPearls ? "Guardando…" : "Guardar perlas"}
            </button>
          </form>
        </div>}
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
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--muted)]">
                {yearHolidays.length} fechas
              </span>
              <button
                aria-controls="year-holidays"
                aria-expanded={showYearHolidays}
                className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs font-medium"
                onClick={() => setShowYearHolidays((shown) => !shown)}
                type="button"
              >
                {showYearHolidays ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          {showYearHolidays && <div id="year-holidays" className="divide-y divide-[var(--line)]">
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
          </div>}
        </div>
      </section>
    </div>
  );
}

