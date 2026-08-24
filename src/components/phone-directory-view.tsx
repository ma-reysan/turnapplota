"use client";

import { Building2, Info, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { phoneDirectoryGroups } from "@/lib/phone-directory";
import type { PhoneContact, PhoneEstablishment } from "@/lib/types";

type ContactForm = {
  establishment: PhoneEstablishment;
  service: string;
  phones: string[];
};

const emptyForm: ContactForm = { establishment: "lota", service: "", phones: [] };

function PhoneChips({ phones, onRemove }: { phones: string[]; onRemove?: (phone: string) => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5 text-right font-mono text-[11px] font-semibold text-[var(--brand)]">
      {phones.map((phone) => (
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-soft)] px-1.5 py-0.5" key={phone}>
          {phone}
          {onRemove ? <button aria-label={`Quitar ${phone}`} className="text-[var(--muted)] hover:text-red-600" onClick={() => onRemove(phone)} type="button"><X size={12} /></button> : null}
        </span>
      ))}
    </div>
  );
}

function DirectoryHeading({ count, editing, onToggleEdit, title }: { count: number; editing: boolean; onToggleEdit: () => void; title: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold"><Building2 className="shrink-0 text-[var(--brand)]" size={17} /><span className="truncate">{title}</span></span>
      <span className="flex shrink-0 items-center gap-1.5"><span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">{count}</span><button aria-label={editing ? `Terminar edición de ${title}` : `Editar ${title}`} className={`grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--brand)] ${editing ? "bg-[var(--brand)] text-white hover:bg-[var(--brand)] hover:text-white" : ""}`} onClick={onToggleEdit} type="button">{editing ? <X size={15} /> : <Settings2 size={15} />}</button></span>
    </div>
  );
}

export function PhoneDirectoryView({ initialContacts }: { initialContacts: PhoneContact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [editingEstablishment, setEditingEstablishment] = useState<PhoneEstablishment | null>(null);
  const [editingContact, setEditingContact] = useState<PhoneContact | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [numberInput, setNumberInput] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const groups = useMemo(() => phoneDirectoryGroups.map((group) => ({ ...group, contacts: contacts.filter((contact) => contact.establishment === group.id) })), [contacts]);

  function openForm(contact?: PhoneContact) {
    setEditingContact(contact ?? null);
    setForm(contact ? { establishment: contact.establishment, service: contact.service, phones: contact.phones } : { ...emptyForm, establishment: editingEstablishment ?? "lota" });
    setNumberInput("");
    setFormOpen(true);
  }

  function addNumber() {
    const value = numberInput.trim();
    if (!value) return;
    if (form.phones.includes(value)) return setNumberInput("");
    setForm((current) => ({ ...current, phones: [...current.phones, value] }));
    setNumberInput("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.phones.length) return toast.error("Agrega al menos un número");
    if (editingContact && !window.confirm(`¿Guardar los cambios de “${editingContact.service}”?`)) return;
    const response = await fetch("/api/phone-contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editingContact?.id }) });
    const result = (await response.json()) as PhoneContact & { error?: string };
    if (!response.ok) return toast.error(result.error ?? "No fue posible guardar el contacto");
    setContacts((current) => (editingContact ? current.map((contact) => contact.id === result.id ? result : contact) : [...current, result]).toSorted((a, b) => a.service.localeCompare(b.service, "es")));
    setFormOpen(false);
    setEditingContact(null);
    setForm(emptyForm);
    toast.success(editingContact ? "Contacto actualizado" : "Contacto agregado");
  }

  async function remove(contact: PhoneContact) {
    if (!window.confirm(`¿Eliminar “${contact.service}”?`)) return;
    const response = await fetch("/api/phone-contacts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: contact.id }) });
    if (!response.ok) return toast.error("No fue posible eliminar el contacto");
    setContacts((current) => current.filter((currentContact) => currentContact.id !== contact.id));
    toast.success("Contacto eliminado");
  }

  function setColumnEditing(establishment: PhoneEstablishment) {
    setEditingEstablishment((current) => current === establishment ? null : establishment);
  }

  function ContactRows({ group }: { group: typeof groups[number] }) {
    const editing = editingEstablishment === group.id;
    return <ul className="divide-y divide-[var(--line)]">{group.contacts.map((contact) => <li className="flex items-start justify-between gap-2 px-3 py-2" key={contact.id}><span className="min-w-0 text-xs font-medium leading-5 text-[var(--foreground)]">{contact.service}{contact.sourceNeedsReview ? <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400" title="Número obtenido de una anotación manuscrita: confirmar antes de usar">⚠</span> : null}</span><span className="flex shrink-0 items-center gap-1.5"><PhoneChips phones={contact.phones} />{editing ? <span className="flex items-center gap-0.5"><button aria-label={`Editar ${contact.service}`} className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--brand)]" onClick={() => openForm(contact)} type="button"><Pencil size={14} /></button><button aria-label={`Eliminar ${contact.service}`} className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-red-600" onClick={() => remove(contact)} type="button"><Trash2 size={14} /></button></span> : null}</span></li>)}</ul>;
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--brand)]">Directorio hospitalario</p><span className="flex items-center gap-1.5"><h1 className="mt-1 text-2xl font-semibold tracking-tight">Teléfonos</h1><span className="relative mt-1"><button aria-expanded={disclaimerOpen} aria-label="Información sobre el directorio telefónico" className="grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--brand)]" onClick={() => setDisclaimerOpen((current) => !current)} type="button"><Info size={16} /></button>{disclaimerOpen ? <span className="absolute left-0 top-8 z-30 w-72 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--muted)] shadow-2xl sm:w-80">Estos telefonos fueron extraidos de los multiples numeros anotados en la urgencia y como el equipo sabe, no todos estan funcionales. Se solicita que si un número no fuese funcional, lo puedan eliminar o editar de la lista.</span> : null}</span></span><p className="mt-1 text-sm text-[var(--muted)]">Anexos de Hospital de Lota, Coronel y Hospital Regional.</p></div><button className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white" onClick={() => openForm()} type="button"><Plus size={15} /> Nuevo contacto</button></header>
      <div className="hidden grid-cols-3 gap-3 lg:grid">{groups.map((group) => { const editing = editingEstablishment === group.id; return <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]" key={group.id}><div className="border-b border-[var(--line)] bg-[var(--surface)] px-3 py-3"><DirectoryHeading count={group.contacts.length} editing={editing} onToggleEdit={() => setColumnEditing(group.id)} title={group.title} /></div><div className="max-h-[calc(100vh-13rem)] overflow-y-auto [content-visibility:auto]"><ContactRows group={group} /></div></section>; })}</div>
      <div className="grid gap-2 lg:hidden">{groups.map((group) => { const editing = editingEstablishment === group.id; return <details className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]" key={group.id}><summary className="list-none [&::-webkit-details-marker]:hidden"><div className="px-3 py-3" onClick={(event) => { if ((event.target as HTMLElement).closest("button")) event.preventDefault(); }}><DirectoryHeading count={group.contacts.length} editing={editing} onToggleEdit={() => setColumnEditing(group.id)} title={group.title} /></div></summary><div className="border-t border-[var(--line)]"><ContactRows group={group} /></div></details>; })}</div>
      <p className="mt-3 px-1 text-[10px] text-[var(--muted)]"><span className="text-amber-600 dark:text-amber-400">⚠</span> Datos transcritos desde anotaciones manuscritas y pendientes de confirmación.</p>
      {formOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3"><form className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl" onSubmit={save}><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-semibold">{editingContact ? "Editar contacto" : "Nuevo contacto"}</h2><button aria-label="Cerrar" onClick={() => setFormOpen(false)} type="button"><X size={18} /></button></div><div className="grid gap-2"><select aria-label="Hospital" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-2 text-sm" onChange={(event) => setForm((current) => ({ ...current, establishment: event.target.value as PhoneEstablishment }))} value={form.establishment}>{phoneDirectoryGroups.map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}</select><input aria-label="Nombre del contacto" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-2 text-sm" onChange={(event) => setForm((current) => ({ ...current, service: event.target.value }))} placeholder="Nombre del contacto o servicio" required value={form.service} /><div className="flex gap-2"><input aria-label="Número" className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-2 text-sm" onChange={(event) => setNumberInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addNumber(); } }} placeholder="Anexo o número" value={numberInput} /><button className="rounded-lg border border-[var(--line)] px-3 text-xs font-semibold hover:bg-[var(--surface-soft)]" onClick={addNumber} type="button">Agregar</button></div>{form.phones.length ? <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-2"><PhoneChips phones={form.phones} onRemove={(phone) => setForm((current) => ({ ...current, phones: current.phones.filter((item) => item !== phone) }))} /></div> : null}<button className="mt-1 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white" type="submit">Guardar contacto</button></div></form></div> : null}
    </div>
  );
}
