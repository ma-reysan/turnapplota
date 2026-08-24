"use client";

import { CalendarDays, ExternalLink, LoaderCircle, RefreshCw, Utensils } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { LunchMenu } from "@/lib/types";

function formatMenuDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(date + "T12:00:00"));
}

export function LunchMenuView({ initialMenu }: { initialMenu: LunchMenu | null }) {
  const [menu, setMenu] = useState(initialMenu);
  const [updating, setUpdating] = useState(false);

  async function refresh() {
    setUpdating(true);
    try {
      const response = await fetch("/api/lunch-menu", { method: "POST" });
      const result = (await response.json()) as LunchMenu & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible actualizar el menú");
      setMenu(result);
      toast.success("Menú actualizado desde Central de Alimentación");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible actualizar el menú");
    } finally {
      setUpdating(false);
    }
  }

  return <div className="mx-auto max-w-3xl">
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--brand)]">Central de Alimentación</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><Utensils className="text-[var(--brand)]" size={24} /> Almuerzo</h1>
      </div>
      <button className="flex items-center gap-2 rounded-xl bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70" disabled={updating} onClick={refresh} type="button">{updating ? <LoaderCircle className="animate-spin" size={16} /> : <RefreshCw size={16} />} Actualizar</button>
    </header>

    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="text-[var(--brand)]" size={17} /> {menu ? formatMenuDate(menu.menuDate) : "Menú no disponible"}</div>
        <a className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--brand)]" href={menu?.sourceUrl ?? "https://sites.google.com/view/centralalimentacinhospitallota/inicio"} rel="noreferrer" target="_blank">Ver fuente oficial <ExternalLink size={13} /></a>
      </div>
      {menu ? <div className="whitespace-pre-line text-center text-sm font-medium leading-7 sm:text-base">{menu.content}</div> : <div className="py-8 text-center text-sm text-[var(--muted)]">Aún no hay un menú guardado. Presiona <strong>Actualizar</strong> para leer el menú publicado hoy.</div>}
      {menu ? <p className="mt-5 border-t border-[var(--line)] pt-3 text-center text-[11px] text-[var(--muted)]">Última lectura: {new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(menu.fetchedAt))}</p> : null}
    </section>
  </div>;
}
