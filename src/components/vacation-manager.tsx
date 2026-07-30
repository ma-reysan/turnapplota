"use client";

import { CalendarOff, Plus, Trash2, Umbrella } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Doctor, Holiday, Vacation } from "@/lib/types";

export function VacationManager({ doctors, initialHolidays, initialVacations }: { doctors: Doctor[]; initialVacations: Vacation[]; initialHolidays: Holiday[] }) {
  const activeDoctors = doctors.filter((doctor) => doctor.active);
  const [vacations, setVacations] = useState(initialVacations);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [doctorId, setDoctorId] = useState(activeDoctors[0]?.id ?? "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [holidayDate, setHolidayDate] = useState(new Date().toISOString().slice(0, 10));
  const [holidayLabel, setHolidayLabel] = useState("");
  const byId = new Map(doctors.map((doctor) => [doctor.id, doctor]));

  async function addVacation(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/vacations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doctorId, startDate, endDate }) });
    const result = await response.json() as { vacation?: Vacation; error?: string };
    if (!response.ok || !result.vacation) return toast.error(result.error ?? "No fue posible guardar las vacaciones");
    const savedVacation = result.vacation;
    setVacations((current) => [...current, savedVacation].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    toast.success("Vacaciones registradas");
  }

  async function removeVacation(id: string) {
    const response = await fetch("/api/vacations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (!response.ok) return toast.error("No fue posible eliminar las vacaciones");
    setVacations((current) => current.filter((item) => item.id !== id));
  }

  async function saveHoliday(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/holidays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: holidayDate, label: holidayLabel || undefined }) });
    const result = await response.json() as { holiday?: Holiday; error?: string };
    if (!response.ok || !result.holiday) return toast.error(result.error ?? "No fue posible guardar el feriado");
    setHolidays((current) => [...current.filter((item) => item.date !== result.holiday!.date), result.holiday!].sort((a, b) => a.date.localeCompare(b.date)));
    setHolidayLabel("");
    toast.success("Feriado guardado");
  }

  async function removeHoliday(date: string) {
    const response = await fetch("/api/holidays", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date }) });
    if (!response.ok) return toast.error("No fue posible eliminar el feriado");
    setHolidays((current) => current.filter((item) => item.date !== date));
  }

  return <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]"><section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3"><div className="flex items-center gap-2"><Umbrella size={17} className="text-sky-600" /><h2 className="text-sm font-semibold">Vacaciones</h2></div><p className="mt-1 text-xs text-[var(--muted)]">Los días registrados ajustan la carga esperada y aparecen como aviso azul al arrastrar un médico.</p><form className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(150px,1fr)_130px_130px_auto] xl:items-end" onSubmit={addVacation}><label className="text-xs text-[var(--muted)]">Médico<select className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>{activeDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.shortName} · {doctor.longName}</option>)}</select></label><label className="text-xs text-[var(--muted)]">Inicio<input className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="text-xs text-[var(--muted)]">Término<input className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><button className="flex h-[31px] items-center justify-center gap-1 rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white" type="submit"><Plus size={14} /> Añadir</button></form><div className="mt-3 divide-y divide-[var(--line)]">{vacations.length ? vacations.map((item) => <div className="flex items-center justify-between gap-2 py-2 text-xs" key={item.id}><span><strong>{byId.get(item.doctorId)?.shortName ?? item.doctorId}</strong><small className="ml-2 text-[var(--muted)]">{item.startDate} — {item.endDate}</small></span><button aria-label="Eliminar vacaciones" className="rounded p-1 text-[var(--muted)] hover:bg-red-100 hover:text-red-700" onClick={() => removeVacation(item.id)} type="button"><Trash2 size={14} /></button></div>) : <p className="py-5 text-center text-xs text-[var(--muted)]">No hay vacaciones registradas.</p>}</div></section><section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3"><div className="flex items-center gap-2"><CalendarOff size={17} className="text-amber-600" /><h2 className="text-sm font-semibold">Feriados de análisis</h2></div><form className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={saveHoliday}><input className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs" type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} /><input className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs" placeholder="Nombre opcional" value={holidayLabel} onChange={(event) => setHolidayLabel(event.target.value)} /><button className="rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white" type="submit">Guardar</button></form><div className="mt-3 divide-y divide-[var(--line)]">{holidays.length ? holidays.map((item) => <div className="flex items-center justify-between gap-2 py-2 text-xs" key={item.date}><span><strong>{item.date}</strong>{item.label ? <small className="ml-2 text-[var(--muted)]">{item.label}</small> : null}</span><button aria-label="Eliminar feriado" className="rounded p-1 text-[var(--muted)] hover:bg-red-100 hover:text-red-700" onClick={() => removeHoliday(item.date)} type="button"><Trash2 size={14} /></button></div>) : <p className="py-5 text-center text-xs text-[var(--muted)]">No hay feriados configurados.</p>}</div></section></div>;
}
