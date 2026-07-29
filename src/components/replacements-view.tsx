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
  const lastInvokedDoctor = lastInvokedDoctorId
    ? doctorsById.get(lastInvokedDoctorId)
    : undefined;
  const pearlColumns = [
    pearls.slice(0, Math.ceil(pearls.length / 2)),
    pearls.slice(Math.ceil(pearls.length / 2)),
  ];
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
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex flex-col gap-2 border-b border-[var(--line)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Puntajes vigentes</h2>
              <span className="rounded-lg border border-amber-200 bg-[#fff8e8] px-2 py-1 text-[10px] font-semibold text-[#5d4822]">
                Último invocado: {lastInvokedDoctor?.shortName ?? "—"}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--muted)]">
              Ventana móvil de los últimos 120 días
            </p>
          </div>
          <div className="flex rounded-lg bg-[var(--surface-soft)] p-0.5">
            {(["table", "list"] as const).map((item) => (
              <button
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
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
                  <th className="sticky left-0 z-10 min-w-28 bg-[var(--surface-soft)] px-3 py-2 text-left">
                    Médico
                  </th>
                  <th className="px-2 py-2 text-right">Total</th>
                  {dates.map((date) => (
                    <th className="min-w-16 px-1.5 py-2 text-center font-medium" key={date}>
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
                    <th className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-2 text-left font-semibold">
                      {doctor.shortName}
                    </th>
                    <td className="px-2 py-2 text-right text-sm font-bold text-[var(--brand)]">
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
                        <td className="px-1.5 py-2 text-center" key={date}>
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
                  className="grid gap-1 px-3 py-2 sm:grid-cols-[105px_1fr_1fr_58px] sm:items-center"
                  key={replacement.id}
                >
                  <time className="text-xs text-[var(--muted)]">{replacement.date}</time>
                  <strong className="text-sm">{doctor?.shortName ?? replacement.doctorId}</strong>
                  <span className="text-xs text-[var(--muted)]">
                    {type?.label ?? "Registro histórico · tipo no informado"}
                  </span>
                  <span className="justify-self-start rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-xs font-bold text-[var(--brand)] sm:justify-self-end">
                    +{replacement.points}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid items-start gap-3 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex items-center gap-2">
            <BookOpen className="text-[var(--brand)]" size={16} />
            <h2 className="text-sm font-semibold">Perlas del equipo</h2>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {pearlColumns.map((column, index) => (
              <div
                className="whitespace-pre-line rounded-xl bg-[var(--surface-soft)] p-3 text-[11px] leading-[1.45]"
                key={`pearls-${index}`}
              >
                {column.join("\n")}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="text-[var(--brand)]" size={16} />
            <h2 className="text-sm font-semibold">Tablita de días</h2>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-1.5">
            {types.map((type) => (
              <div
                className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-[var(--surface-soft)] px-2 py-1.5"
                key={type.code}
              >
                <dt className="text-[10px] leading-tight text-[var(--muted)]">{type.label}</dt>
                <dd className="text-sm font-bold text-[var(--brand)]">
                  +{type.defaultPoints}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
