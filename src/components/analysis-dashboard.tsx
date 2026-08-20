"use client";

import { ArrowDownUp, BarChart3, CalendarDays, Moon, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import { buildPeriodAnalysis, monthRange } from "@/lib/analysis";
import type { DoctorAnalysis } from "@/lib/analysis";
import type { Doctor, Holiday, ScheduleMonth } from "@/lib/types";
import { cn, monthLabel } from "@/lib/utils";

type SortKey = "doctor" | "total" | "day" | "night" | "special" | "expected" | "difference";

function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Sun }) {
  return <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"><Icon size={16} className="text-[var(--brand)]" /><p className="mt-3 text-xl font-semibold">{value}</p><p className="text-[10px] text-[var(--muted)]">{label}</p></div>;
}

function SortHeader({ label, field, active, direction, onSort }: { label: string; field: SortKey; active: SortKey; direction: "asc" | "desc"; onSort: (field: SortKey) => void }) {
  return <th className="px-1 py-2 text-center first:px-3 first:text-left"><button className="inline-flex items-center gap-1 hover:text-[var(--foreground)]" onClick={() => onSort(field)} type="button">{label}{active === field ? <span>{direction === "asc" ? "↑" : "↓"}</span> : <ArrowDownUp size={11} />}</button></th>;
}

export function AnalysisDashboard({ doctors, schedules, holidays }: { doctors: Doctor[]; schedules: ScheduleMonth[]; holidays: Holiday[] }) {
  const months = useMemo(() => [...schedules].filter((item) => item.status === "published").sort((a, b) => b.id.localeCompare(a.id)), [schedules]);
  const [selectedId, setSelectedId] = useState(months[0]?.id ?? "");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "doctor", direction: "asc" });
  const selected = months.find((month) => month.id === selectedId) ?? months[0];
  const monthly = useMemo(() => selected ? buildPeriodAnalysis({ doctors, schedules, holidays, ...monthRange(selected.year, selected.month) }) : null, [doctors, holidays, schedules, selected]);
  const sortedMetrics = useMemo(() => {
    if (!monthly) return [];
    const value = (item: DoctorAnalysis) => ({ doctor: item.doctor.shortName, total: item.total, day: item.day + item.daySpecial, night: item.night + item.nightSpecial, special: item.daySpecial + item.nightSpecial, expected: item.expected.total, difference: item.difference })[sort.key];
    return [...monthly.metrics].sort((a, b) => { const first = value(a); const second = value(b); const result = typeof first === "string" ? first.localeCompare(String(second)) : Number(first) - Number(second); return sort.direction === "asc" ? result : -result; });
  }, [monthly, sort]);

  function toggleSort(key: SortKey) { setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: key === "doctor" ? "asc" : "desc" }); }
  if (!selected || !monthly) return <div className="rounded-2xl bg-[var(--surface)] p-5">No hay meses publicados para analizar.</div>;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">Gestión clínica</p><h1 className="text-2xl font-semibold tracking-tight">Análisis</h1></div><select className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs capitalize" value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{months.map((month) => <option value={month.id} key={month.id}>{monthLabel(month.year, month.month)}</option>)}</select></div>
    <section className="space-y-3"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Turnos del mes" value={monthly.assignments.length} icon={CalendarDays} /><MetricCard label="Turnos de día" value={monthly.assignments.filter((item) => item.kind === "DAY").length} icon={Sun} /><MetricCard label="Turnos de noche" value={monthly.assignments.filter((item) => item.kind === "NIGHT").length} icon={Moon} /><MetricCard label="Casillas pendientes" value={monthly.missingSlots} icon={BarChart3} /></div><section className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]"><table className="min-w-full text-xs"><thead className="bg-[var(--surface-soft)] text-[var(--muted)]"><tr><SortHeader label="Médico" field="doctor" active={sort.key} direction={sort.direction} onSort={toggleSort} /><SortHeader label="Turnos" field="total" active={sort.key} direction={sort.direction} onSort={toggleSort} /><SortHeader label="Día" field="day" active={sort.key} direction={sort.direction} onSort={toggleSort} /><SortHeader label="Noche" field="night" active={sort.key} direction={sort.direction} onSort={toggleSort} /><SortHeader label="FDS/Fest." field="special" active={sort.key} direction={sort.direction} onSort={toggleSort} /><SortHeader label="Esperado" field="expected" active={sort.key} direction={sort.direction} onSort={toggleSort} /><SortHeader label="Diferencial" field="difference" active={sort.key} direction={sort.direction} onSort={toggleSort} /></tr></thead><tbody>{sortedMetrics.map((item) => <tr className="border-t border-[var(--line)]" key={item.doctor.id}><th className="px-3 py-2 text-left">{item.doctor.shortName}</th><td className="text-center">{item.total}</td><td className="text-center">{item.day + item.daySpecial}</td><td className="text-center">{item.night + item.nightSpecial}</td><td className="text-center">{item.daySpecial + item.nightSpecial}</td><td className="text-center">{item.expected.total.toFixed(1)}</td><td className={cn("text-center font-semibold", item.difference > .5 ? "text-amber-600" : item.difference < -.5 ? "text-sky-600" : "text-[var(--brand)]")}>{item.difference > 0 ? "+" : ""}{item.difference.toFixed(1)}</td></tr>)}</tbody></table></section></section>
  </div>;
}
