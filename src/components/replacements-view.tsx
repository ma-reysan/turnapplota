"use client";

import { BookOpen, List, Sparkles, Table2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReplacementStatus } from "@/components/replacement-status";
import type { Doctor, Replacement, ReplacementType } from "@/lib/types";
import { cn, isActiveReplacement } from "@/lib/utils";

const pearlSectionLabels = {
  perlas: "Perlas",
  puntos: "Puntos",
  superheroe: "Superhéroe",
  comodindeapoyo: "Comodín de apoyo",
} as const;

type PearlSectionKey = keyof typeof pearlSectionLabels;

function groupPearls(pearls: string[]) {
  const sections: Record<PearlSectionKey, string[]> = {
    perlas: [],
    puntos: [],
    superheroe: [],
    comodindeapoyo: [],
  };
  let current: PearlSectionKey = "perlas";

  for (const line of pearls) {
    const key = line
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/gi, "")
      .toLowerCase() as PearlSectionKey;

    if (key in pearlSectionLabels) {
      current = key;
    } else if (line.trim()) {
      sections[current].push(line.trim());
    }
  }

  return Object.entries(sections) as [PearlSectionKey, string[]][];
}

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
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const doctorsById = useMemo(
    () => new Map(doctors.map((doctor) => [doctor.id, doctor])),
    [doctors],
  );
  const typesByCode = useMemo(() => new Map(types.map((type) => [type.code, type])), [types]);
  const lastInvokedDoctor = lastInvokedDoctorId
    ? doctorsById.get(lastInvokedDoctorId)
    : undefined;
  const pearlSections = groupPearls(pearls);
  const sortedReplacements = [...replacements].sort((a, b) => b.date.localeCompare(a.date));
  const active = replacements.filter((replacement) => isActiveReplacement(replacement.date));
  const dates = [...new Set(replacements.map((replacement) => replacement.date))].sort((a, b) =>
    a.localeCompare(b),
  );
  const rankedDoctors = doctors
    .map((doctor) => ({
      doctor,
      hasEntries: replacements.some((replacement) => replacement.doctorId === doctor.id),
      points: active
        .filter((replacement) => replacement.doctorId === doctor.id)
        .reduce((sum, replacement) => sum + replacement.points, 0),
    }))
    .filter(({ hasEntries }) => hasEntries)
    .sort((a, b) => a.points - b.points || a.doctor.shortName.localeCompare(b.doctor.shortName));

  useEffect(() => {
    if (mode !== "table" || !tableScrollRef.current) return;
    tableScrollRef.current.scrollLeft = tableScrollRef.current.scrollWidth;
  }, [dates.length, mode]);

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex flex-col gap-2 border-b border-[var(--line)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Puntajes vigentes</h2>
            <p className="mt-0.5 text-[10px] text-[var(--muted)]">
              Ventana móvil de los últimos 120 días
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="flex h-8 w-full items-center justify-center rounded-lg border border-amber-200 bg-[#fff8e8] px-2 text-[10px] font-semibold text-[#5d4822] sm:w-[190px]">
              🛡️ Último Convocado: {lastInvokedDoctor?.shortName ?? "—"}
            </span>
            <div className="flex h-8 w-full rounded-lg bg-[var(--surface-soft)] p-0.5 sm:w-[190px]">
              {(["table", "list"] as const).map((item) => (
                <button
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
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
        </div>

        {mode === "table" ? (
          <div className="scrollbar-subtle overflow-x-auto" ref={tableScrollRef}>
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-soft)] text-[var(--muted)]">
                  <th className="sticky left-0 z-10 min-w-24 bg-[var(--surface-soft)] px-2 py-1.5 text-left">
                    Médico
                  </th>
                  <th className="sticky left-24 z-10 min-w-14 bg-[var(--surface-soft)] px-1.5 py-1.5 text-right">Total vigente</th>
                  {dates.map((date) => (
                    <th
                      className={cn(
                        "min-w-14 px-1 py-1.5 text-center font-medium",
                        !isActiveReplacement(date) && "opacity-35",
                      )}
                      key={date}
                    >
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
                    <th className="sticky left-0 z-10 bg-[var(--surface)] px-2 py-1.5 text-left font-semibold">
                      {doctor.shortName}
                    </th>
                    <td className="sticky left-24 z-10 min-w-14 bg-[var(--surface)] px-1.5 py-1.5 text-right text-sm font-bold text-[var(--brand)]">
                      {points}
                    </td>
                    {dates.map((date) => {
                      const value = replacements
                        .filter(
                          (replacement) =>
                            replacement.doctorId === doctor.id && replacement.date === date,
                        )
                        .reduce((sum, replacement) => sum + replacement.points, 0);
                      return (
                        <td
                          className={cn(
                            "px-1 py-1.5 text-center",
                            !isActiveReplacement(date) && "text-[var(--muted)] opacity-35",
                          )}
                          key={date}
                        >
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
          <div className="mx-auto divide-y divide-[var(--line)] lg:w-3/5">
            {sortedReplacements.slice(0, 80).map((replacement) => {
              const doctor = doctorsById.get(replacement.doctorId);
              const type = typesByCode.get(replacement.typeCode);
              return (
                <article
                  className="grid gap-x-2 gap-y-0.5 px-2 py-1.5 sm:grid-cols-[90px_110px_minmax(150px,1fr)_auto_48px] sm:items-center"
                  key={replacement.id}
                >
                  <time className="text-xs text-[var(--muted)]">{replacement.date}</time>
                  <strong className="text-xs">{doctor?.shortName ?? replacement.doctorId}</strong>
                  <span className="text-[11px] text-[var(--muted)]">
                    {type?.label ?? "Registro histórico · tipo no informado"}
                  </span>
                  <span className="flex items-center justify-start gap-0.5 sm:justify-end">
                    {replacement.mode === "invoked" ? (
                      <ReplacementStatus emoji="🪽" label="Invocado" />
                    ) : null}
                    {replacement.superhero ? (
                      <ReplacementStatus emoji="🦸" label="Superhéroe" />
                    ) : null}
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
            {pearlSections.map(([key, lines]) => (
              <article className="rounded-xl bg-[var(--surface-soft)] p-3" key={key}>
                <h3 className="text-xs font-semibold text-[var(--brand)]">
                  {pearlSectionLabels[key]}
                </h3>
                <div className="mt-1.5 divide-y divide-[var(--line)]">
                  {lines.map((line, index) => (
                    <p
                      className="py-1.5 text-[11px] leading-[1.4] first:pt-0 last:pb-0"
                      key={`${key}-${index}`}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </article>
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
                <dt className="text-[10px] leading-tight text-[var(--muted)] lg:text-xs">
                  {type.label}
                </dt>
                <dd className="text-sm font-bold text-[var(--brand)] lg:text-base">
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
