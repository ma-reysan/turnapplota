"use client";

import { BookOpen, List, Sparkles, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Doctor, Replacement, ReplacementType } from "@/lib/types";
import { cn, isActiveReplacement } from "@/lib/utils";

export function ReplacementsView({
  doctors,
  replacements,
  types,
  pearls,
  lastInvokedDoctorId,
}: {
  doctors: Doctor[];
  replacements: Replacement[];
  types: ReplacementType[];
  pearls: string[];
  lastInvokedDoctorId?: string;
}) {
  const [mode, setMode] = useState<"table" | "list">("table");
  const doctorsById = useMemo(
    () => new Map(doctors.map((doctor) => [doctor.id, doctor])),
    [doctors],
  );
  const typesByCode = useMemo(() => new Map(types.map((type) => [type.code, type])), [types]);
  const active = replacements.filter((replacement) => isActiveReplacement(replacement.date));
  const dates = [...new Set(active.map((replacement) => replacement.date))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 18)
    .reverse();
  const rankedDoctors = doctors
    .map((doctor) => ({
      doctor,
      points: active
        .filter((replacement) => replacement.doctorId === doctor.id)
        .reduce((sum, replacement) => sum + replacement.points, 0),
    }))
    .filter(({ points }) => points > 0)
    .sort((a, b) => a.points - b.points || a.doctor.shortName.localeCompare(b.doctor.shortName));

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Puntajes vigentes</h2>
            <p className="text-xs text-[var(--muted)]">Ventana móvil de los últimos 120 días</p>
          </div>
          <div className="flex rounded-xl bg-[var(--surface-soft)] p-1">
            {(["table", "list"] as const).map((item) => (
              <button
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                  mode === item ? "bg-[var(--surface)] shadow-sm" : "text-[var(--muted)]",
                )}
                key={item}
                onClick={() => setMode(item)}
                type="button"
              >
                {item === "table" ? <Table2 size={15} /> : <List size={15} />}
                {item === "table" ? "Tabla" : "Lista"}
              </button>
            ))}
          </div>
        </div>

        {mode === "table" ? (
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-soft)] text-[var(--muted)]">
                  <th className="sticky left-0 z-10 min-w-32 bg-[var(--surface-soft)] px-4 py-3 text-left">
                    Médico
                  </th>
                  <th className="px-3 py-3 text-right">Total</th>
                  {dates.map((date) => (
                    <th className="min-w-20 px-2 py-3 text-center font-medium" key={date}>
                      {new Intl.DateTimeFormat("es-CL", {
                        day: "2-digit",
                        month: "short",
                      }).format(new Date(`${date}T12:00:00`))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankedDoctors.map(({ doctor, points }) => (
                  <tr className="border-t border-[var(--line)]" key={doctor.id}>
                    <th className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-3 text-left font-semibold">
                      {doctor.shortName}
                      {doctor.id === lastInvokedDoctorId ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] text-amber-900">
                          Último invocado
                        </span>
                      ) : null}
                    </th>
                    <td className="px-3 py-3 text-right text-base font-bold text-[var(--brand)]">
                      {points}
                    </td>
                    {dates.map((date) => {
                      const value = active
                        .filter(
                          (replacement) =>
                            replacement.doctorId === doctor.id && replacement.date === date,
                        )
                        .reduce((sum, replacement) => sum + replacement.points, 0);
                      return (
                        <td className="px-2 py-3 text-center" key={date}>
                          {value || "·"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {replacements.slice(0, 80).map((replacement) => {
              const doctor = doctorsById.get(replacement.doctorId);
              const type = typesByCode.get(replacement.typeCode);
              return (
                <article
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[120px_1fr_1fr_70px] sm:items-center"
                  key={replacement.id}
                >
                  <time className="text-xs text-[var(--muted)]">{replacement.date}</time>
                  <strong className="text-sm">{doctor?.shortName ?? replacement.doctorId}</strong>
                  <span className="text-xs text-[var(--muted)]">
                    {type?.label ?? "Registro histórico · tipo no informado"}
                  </span>
                  <span className="justify-self-start rounded-full bg-[var(--surface-soft)] px-3 py-1 text-sm font-bold text-[var(--brand)] sm:justify-self-end">
                    +{replacement.points}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <BookOpen className="text-[var(--brand)]" size={19} />
            <h2 className="text-lg font-semibold">Perlas del equipo</h2>
          </div>
          <div className="mt-5 space-y-3">
            {pearls.map((pearl, index) => (
              <div
                className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm leading-6"
                key={`${index}-${pearl.slice(0, 18)}`}
              >
                {pearl}
              </div>
            ))}
          </div>
        </section>
        <section className="self-start rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <Sparkles className="text-[var(--brand)]" size={19} />
            <h2 className="text-lg font-semibold">Tablita de días</h2>
          </div>
          <dl className="mt-5 divide-y divide-[var(--line)]">
            {types.map((type) => (
              <div className="flex items-center justify-between gap-4 py-3" key={type.code}>
                <dt className="text-sm text-[var(--muted)]">{type.label}</dt>
                <dd className="text-lg font-bold text-[var(--brand)]">
                  {type.code.startsWith("HERO") ? "+1" : type.defaultPoints}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
