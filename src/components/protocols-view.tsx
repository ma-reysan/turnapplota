"use client";

import { ExternalLink, Info, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Protocol, ProtocolCategory } from "@/lib/types";
import { formatDateTime, normalizeSearch } from "@/lib/utils";

const categories: Array<{ id: ProtocolCategory; label: string }> = [
  { id: "pediatrics", label: "Pediatría" },
  { id: "surgery", label: "Cirugía" },
  { id: "neurology", label: "Neurología" },
  { id: "ophthalmology", label: "Oftalmología" },
  { id: "ent", label: "Otorrinolaringología" },
  { id: "aps_network", label: "Red APS" },
  // Capítulos del manual de acreditación, en el orden numérico del Hospital.
  { id: "quality_dp", label: "01 · DP · Dignidad del paciente" },
  { id: "quality_cal", label: "02 · CAL · Gestión de la calidad" },
  { id: "quality_gcl", label: "03 · GCL · Gestión clínica" },
  { id: "quality_aoc", label: "04 · AOC · Acceso, oportunidad y continuidad" },
  { id: "quality_rh", label: "05 · RH · Competencias del recurso humano" },
  { id: "quality_reg", label: "06 · REG · Registros" },
  { id: "quality_eq", label: "07 · EQ · Seguridad del equipamiento" },
  { id: "quality_ins", label: "08 · INS · Seguridad de las instalaciones" },
  { id: "quality_apl", label: "09 · APL · Apoyo · Laboratorio clínico" },
  { id: "quality_apf", label: "10 · APF · Apoyo · Farmacia" },
  { id: "quality_ape", label: "11 · APE · Apoyo · Esterilización" },
  { id: "quality_apt", label: "12 · APT · Apoyo · Movilización" },
  { id: "quality_apa", label: "13 · APA · Apoyo · Anatomía patológica" },
  { id: "quality_api", label: "15 · API · Apoyo · Imagenología" },
  { id: "quality_apk", label: "16 · APK · Apoyo · Kinesioterapia" },
  { id: "quality_aptr", label: "17 · APTr · Apoyo · Medicina transfusional" },
  { id: "quality_gd", label: "18 · GD · Gestión documental" },
  { id: "quality", label: "Calidad y seguridad" },
  { id: "clinical", label: "Otros clínicos" },
];

const empty = { title: "", url: "", category: "pediatrics" as ProtocolCategory, updatedBy: "" };

export function ProtocolsView({ initialProtocols }: { initialProtocols: Protocol[] }) {
  const [protocols, setProtocols] = useState(initialProtocols);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Protocol | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [infoId, setInfoId] = useState<string | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const normalizedQuery = normalizeSearch(query);
  const filtered = useMemo(
    () => protocols.filter((item) => normalizeSearch(item.title).includes(normalizedQuery)),
    [protocols, normalizedQuery],
  );
  const filtering = query.trim().length > 0;
  const categorySections = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          rows: filtered.filter((item) => item.category === category.id),
        }))
        .filter((section) => section.rows.length > 0),
    [filtered],
  );

  function openForm(item?: Protocol) {
    setEditing(item ?? null);
    setFormOpen(true);
    setForm(item ? { title: item.title, url: item.url, category: item.category, updatedBy: "" } : empty);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.updatedBy.trim()) return toast.error("Indica quién actualiza el link");
    if (editing && !window.confirm(`¿Guardar los cambios de “${editing.title}”?`)) return;
    const response = await fetch("/api/protocols", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editing?.id }) });
    const result = (await response.json()) as Protocol & { error?: string };
    if (!response.ok) return toast.error(result.error ?? "No fue posible guardar");
    setProtocols((current) => (editing ? current.map((item) => item.id === result.id ? result : item) : [...current, result]).sort((a, b) => a.title.localeCompare(b.title, "es")));
    setEditing(null); setForm(empty); setFormOpen(false); toast.success(editing ? "Protocolo actualizado" : "Protocolo agregado");
  }

  async function remove(item: Protocol) {
    const updatedBy = window.prompt(`¿Quién elimina “${item.title}”?`)?.trim();
    if (!updatedBy || !window.confirm(`¿Eliminar “${item.title}”?`)) return;
    const response = await fetch("/api/protocols", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, updatedBy }) });
    if (!response.ok) return toast.error("No fue posible eliminar el protocolo");
    setProtocols((current) => current.filter((currentItem) => currentItem.id !== item.id));
    toast.success("Protocolo eliminado");
  }

  return <div className="mx-auto max-w-4xl">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--brand)]">Biblioteca del Drive de mgzlota</p><span className="flex items-center gap-1.5"><h1 className="text-2xl font-semibold">Protocolos</h1><span className="relative"><button aria-expanded={disclaimerOpen} aria-label="Información sobre los protocolos" className="grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--brand)]" onClick={() => setDisclaimerOpen((current) => !current)} type="button"><Info size={16} /></button>{disclaimerOpen ? <span className="absolute left-0 top-8 z-30 w-72 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--muted)] shadow-2xl sm:w-80">Estos archivos fueron actualizados en su totalidad en agosto 2026 desde el repositorio de Calidad del Hospital. Nadie se hará responsable de actualizarlos. He implementado el botón para actualizarlos cuando sea necesario. Favor, usarlo.</span> : null}</span></span></div><button className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white" onClick={() => openForm()} type="button"><Plus size={15} /> Agregar enlace</button></div>
    <label className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2"><Search size={16} className="text-[var(--muted)]" /><input className="w-full bg-transparent text-sm outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar protocolo…" value={query} /></label>
    {categorySections.map(({ category, rows }) => <section className="mb-4" key={category.id}><h2 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--muted)]">{category.label}</h2><div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">{rows.length ? rows.map((item) => <div className="group flex items-center gap-1.5 border-b border-[var(--line)] px-3 py-2 last:border-0" key={item.id}><a className="min-w-0 flex flex-1 items-center gap-2 truncate text-sm font-medium hover:text-[var(--brand)]" href={item.url} rel="noreferrer" target="_blank"><span className="truncate">{item.title}</span><ExternalLink className="shrink-0 opacity-45" size={13} /></a><span className="relative group/info"><button aria-expanded={infoId === item.id} aria-label={`Información de ${item.title}`} className="grid h-6 w-6 place-items-center text-lg leading-none text-[var(--muted)] hover:text-[var(--brand)]" onClick={() => setInfoId((current) => current === item.id ? null : item.id)} type="button"><span aria-hidden="true">ⓘ</span></button><span className={`pointer-events-none absolute right-0 top-7 z-30 w-52 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[10px] leading-4 shadow-xl ${infoId === item.id ? "block" : "hidden group-hover/info:block group-focus-within/info:block"}`}>Actualizado por <strong>{item.updatedBy}</strong><br />{formatDateTime(item.updatedAt)}</span></span><button aria-label={`Editar ${item.title}`} className="rounded p-1 text-[var(--muted)] hover:text-[var(--brand)] md:opacity-0 md:group-hover:opacity-100" onClick={() => openForm(item)} type="button"><Pencil size={13} /></button><button aria-label={`Eliminar ${item.title}`} className="rounded p-1 text-[var(--muted)] hover:text-red-600 md:opacity-0 md:group-hover:opacity-100" onClick={() => remove(item)} type="button"><Trash2 size={13} /></button></div>) : <p className="px-3 py-3 text-xs text-[var(--muted)]">No hay protocolos en esta categoría.</p>}</div></section>)}
    {filtering && !categorySections.length ? <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-4 text-sm text-[var(--muted)]">No se encontraron protocolos.</p> : null}
    {formOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3"><form className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl" onSubmit={save}><div className="mb-3 flex justify-between"><h2 className="text-base font-semibold">{editing ? "Editar protocolo" : "Agregar protocolo"}</h2><button onClick={() => { setEditing(null); setForm(empty); setFormOpen(false); }} type="button"><X size={18} /></button></div><div className="grid gap-2">{([ ["title", "Nombre del protocolo", "text"], ["url", "Enlace", "url"], ["updatedBy", "¿Quién actualiza el link?", "text"] ] as const).map(([key, label, type]) => <input aria-label={label} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]" key={key} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={label} required type={type} value={form[key]} />)}<select aria-label="Categoría" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-2 text-sm text-[var(--foreground)]" onChange={(event) => setForm({ ...form, category: event.target.value as ProtocolCategory })} value={form.category}>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button className="mt-1 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white" type="submit">Guardar</button></div></form></div> : null}
  </div>;
}
