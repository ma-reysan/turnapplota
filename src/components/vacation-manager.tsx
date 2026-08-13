"use client";

import { CalendarOff, Plus, Trash2, Umbrella } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Doctor, Holiday, Vacation } from "@/lib/types";

function chileDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function formatHolidayDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function VacationManager({
  doctors,
  initialHolidays,
  initialVacations,
}: {
  doctors: Doctor[];
  initialVacations: Vacation[];
  initialHolidays: Holiday[];
}) {
  const activeDoctors = doctors.filter((doctor) => doctor.active);
  const router = useRouter();
  const [vacations, setVacations] = useState(initialVacations);
  const [holidays, setHolidays] = useState(() =>
    [...initialHolidays].sort((a, b) => a.date.localeCompare(b.date)),
  );
  const [doctorId, setDoctorId] = useState(activeDoctors[0]?.id ?? "");
  const [startDate, setStartDate] = useState(
    chileDateKey(),
  );
  const [endDate, setEndDate] = useState(chileDateKey());
  const [singleDay, setSingleDay] = useState(false);
  const [holidayDate, setHolidayDate] = useState(
    chileDateKey(),
  );
  const [holidayLabel, setHolidayLabel] = useState("");
  const byId = new Map(doctors.map((doctor) => [doctor.id, doctor]));
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

  async function addVacation(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/vacations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId, startDate, endDate }),
    });
    const result = (await response.json()) as {
      vacation?: Vacation;
      error?: string;
    };
    if (!response.ok || !result.vacation)
      return toast.error(
        result.error ?? "No fue posible guardar las vacaciones",
      );
    const savedVacation = result.vacation;
    setVacations((current) =>
      [...current, savedVacation].sort((a, b) =>
        a.startDate.localeCompare(b.startDate),
      ),
    );
    router.refresh();
    toast.success("Vacaciones registradas");
  }

  async function removeVacation(id: string) {
    const response = await fetch("/api/vacations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok)
      return toast.error("No fue posible eliminar las vacaciones");
    setVacations((current) => current.filter((item) => item.id !== id));
    router.refresh();
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
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="flex items-center gap-2">
          <Umbrella size={17} className="text-sky-600" />
          <h2 className="text-sm font-semibold">Vacaciones</h2>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Los días registrados ajustan la carga esperada y aparecen como aviso
          azul al arrastrar un médico.
        </p>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(145px,1fr)_118px_118px_auto] xl:items-end"
          onSubmit={addVacation}
        >
          <label className="text-xs text-[var(--muted)]">
            Médico
            <select
              className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
              value={doctorId}
              onChange={(event) => setDoctorId(event.target.value)}
            >
              {activeDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.shortName} · {doctor.longName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[var(--muted)]">
            Desde
            <input
              aria-label="Inicio de vacaciones"
              className="mt-1 block h-[31px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1 text-xs"
              type="date"
              value={startDate}
              onChange={(event) => {
                const nextStart = event.target.value;
                setStartDate(nextStart);
                if (singleDay || endDate < nextStart) setEndDate(nextStart);
              }}
            />
          </label>
          <label className="text-xs text-[var(--muted)]">
            Hasta
            <input
              aria-label="Término de vacaciones"
              className="mt-1 block h-[31px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-45"
              disabled={singleDay}
              min={startDate}
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label className="col-span-full flex h-[29px] w-fit items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 text-xs text-[var(--foreground)] xl:col-span-1 xl:col-start-2">
            <input
              checked={singleDay}
              className="size-3.5 accent-[var(--brand)]"
              onChange={(event) => {
                const checked = event.target.checked;
                setSingleDay(checked);
                if (checked) setEndDate(startDate);
              }}
              type="checkbox"
            />
            Solo un día
          </label>
          <button
            className="flex h-[31px] items-center justify-center gap-1 rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white xl:col-start-4 xl:row-span-2"
            type="submit"
          >
            <Plus size={14} /> Añadir
          </button>
        </form>
        <div className="mt-3 divide-y divide-[var(--line)]">
          {vacations.length ? (
            vacations.map((item) => (
              <div
                className="flex items-center justify-between gap-2 py-2 text-xs"
                key={item.id}
              >
                <span>
                  <strong>
                    {byId.get(item.doctorId)?.shortName ?? item.doctorId}
                  </strong>
                  <small className="ml-2 text-[var(--muted)]">
                    {item.startDate} — {item.endDate}
                  </small>
                </span>
                <button
                  aria-label="Eliminar vacaciones"
                  className="rounded p-1 text-[var(--muted)] hover:bg-red-100 hover:text-red-700"
                  onClick={() => removeVacation(item.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <p className="py-5 text-center text-xs text-[var(--muted)]">
              No hay vacaciones registradas.
            </p>
          )}
        </div>
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
