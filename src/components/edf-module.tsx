"use client";

import { CalendarDays, Download, ExternalLink, FileText, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import type { ApsAgenda, Doctor, ScheduleMonth } from "@/lib/types";
import { agendaDate, mergeAgendaActivities, parseAgendaWorkbook, type AgendaActivity } from "@/lib/agenda-analyzer";
import { exportAgendaPdf } from "@/lib/agenda-pdf";
import { exportDoctorShiftsPdf } from "@/lib/edf-pdf";
import { monthLabel, normalizeDoctorSearch } from "@/lib/utils";

const ADMIN_HOURS_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSda2dEPAXhCey_5rO1sKw1KLOYux-e5ST-OQx67y-c7AoRVdw/viewform";

type MonthOption = { id: string; year: number; month: number; schedule: ScheduleMonth };
type DoctorOption = { name: string; rowIdx: number };

function normalizedName(value: string) {
  return normalizeDoctorSearch(value)
    .replace(/\b(DR|DRA|DOCTOR|DOCTORA|MEDICO|MEDICA)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchesDoctor(name: string, doctor: Doctor) {
  const excelName = normalizedName(name);
  const candidates = [normalizedName(doctor.shortName), normalizedName(doctor.longName)].filter(Boolean);
  return candidates.some((candidate) =>
    excelName === candidate || excelName.endsWith(` ${candidate}`) || candidate.endsWith(` ${excelName}`),
  );
}

function agendaDayDate(value: string, year: number) {
  const date = agendaDate(value);
  if (!date) return null;
  const withYear = new Date(year, date.getMonth(), date.getDate(), 12);
  const yearMatch = value.match(/\b(20\d{2})\b/);
  if (yearMatch) withYear.setFullYear(Number(yearMatch[1]));
  return withYear;
}

export function EdfModule({
  doctors,
  schedules,
  initialAgenda,
}: {
  doctors: Doctor[];
  schedules: ScheduleMonth[];
  initialAgenda?: ApsAgenda;
}) {
  const months = useMemo<MonthOption[]>(() => schedules
    .slice()
    .sort((a, b) => b.id.localeCompare(a.id))
    .map((schedule) => ({ id: schedule.id, year: schedule.year, month: schedule.month, schedule })), [schedules]);
  const [selectedMonthId, setSelectedMonthId] = useState(months[0]?.id ?? "");
  const [selectedDoctorName, setSelectedDoctorName] = useState("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [loading, setLoading] = useState(Boolean(initialAgenda));
  const [exporting, setExporting] = useState<"turnos" | "agenda" | null>(null);
  const selectedMonth = months.find((month) => month.id === selectedMonthId);

  const loadWorkbook = useCallback(async () => {
    if (!initialAgenda) return;
    setLoading(true);
    try {
      const response = await fetch("/api/agenda-aps?download=1");
      if (!response.ok) throw new Error("No fue posible abrir el Excel vigente de Agenda APS");
      const file = await response.arrayBuffer();
      setWorkbook(XLSX.read(new Uint8Array(file), { type: "array" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible leer la Agenda APS");
    } finally {
      setLoading(false);
    }
  }, [initialAgenda]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkbook(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkbook]);

  const workbookDoctors = useMemo<DoctorOption[]>(() => {
    if (!workbook) return [];
    const entries = workbook.SheetNames.flatMap((sheetName) => {
      const parsed = parseAgendaWorkbook(workbook, sheetName);
      return parsed?.doctors ?? [];
    });
    const unique = new Map<string, DoctorOption>();
    entries.forEach((doctor) => {
      const key = normalizedName(doctor.name);
      if (key && !unique.has(key)) unique.set(key, doctor);
    });
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "es-CL"));
  }, [workbook]);

  const doctorOptions = workbookDoctors.length
    ? workbookDoctors
    : doctors.filter((doctor) => doctor.active).map((doctor) => ({ name: doctor.longName, rowIdx: -1 }));
  const preferredDoctorName = doctorOptions.find((item) => doctors.some((doctor) => doctor.active && matchesDoctor(item.name, doctor)))?.name
    ?? doctorOptions[0]?.name
    ?? "";
  const doctorName = selectedDoctorName || preferredDoctorName;
  const matchingDoctor = doctors.find((doctor) => doctorName && matchesDoctor(doctorName, doctor));
  const selectedSchedule = selectedMonth?.schedule;

  const exportTurnos = useCallback(async () => {
    if (!selectedSchedule || !doctorName || exporting) return;
    setExporting("turnos");
    try {
      const selectedAssignments = selectedSchedule.assignments
        .filter((assignment) => matchingDoctor && assignment.doctorId === matchingDoctor.id)
        .sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.slot - b.slot);
      if (!selectedAssignments.length) throw new Error(`No hay turnos publicados de ${doctorName} en ${monthLabel(selectedSchedule.year, selectedSchedule.month)}`);
      await exportDoctorShiftsPdf({
        doctorName,
        year: selectedSchedule.year,
        month: selectedSchedule.month,
        assignments: selectedAssignments,
      });
      toast.success("PDF de turnos descargado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible generar el PDF de turnos");
    } finally {
      setExporting(null);
    }
  }, [doctorName, exporting, matchingDoctor, selectedSchedule]);

  const exportAgenda = useCallback(async () => {
    if (!workbook || !selectedMonth || !doctorName || exporting) return;
    setExporting("agenda");
    try {
      const days: Array<{ label: string; date: string; activities: AgendaActivity[]; timestamp: number }> = [];
      workbook.SheetNames.forEach((sheetName) => {
        const overview = parseAgendaWorkbook(workbook, sheetName);
        const doctor = overview?.doctors.find((item) => normalizedName(item.name) === normalizedName(doctorName));
        if (!doctor) return;
        const parsed = parseAgendaWorkbook(workbook, sheetName, doctor.rowIdx);
        parsed?.days.forEach((day) => {
          const date = agendaDayDate(day.date, selectedMonth.year);
          if (!date || date.getFullYear() !== selectedMonth.year || date.getMonth() + 1 !== selectedMonth.month) return;
          days.push({
            label: day.label,
            date: day.date,
            activities: mergeAgendaActivities(parsed.schedule[day.col] ?? []),
            timestamp: date.getTime(),
          });
        });
      });
      const groupedDays = new Map<number, (typeof days)[number]>();
      days.sort((a, b) => a.timestamp - b.timestamp).forEach((day) => {
        const current = groupedDays.get(day.timestamp);
        if (current) current.activities = mergeAgendaActivities([...current.activities, ...day.activities]);
        else groupedDays.set(day.timestamp, day);
      });
      const uniqueDays = [...groupedDays.values()];
      if (!uniqueDays.length) throw new Error(`No hay tareas de ${doctorName} en el Excel vigente para ${monthLabel(selectedMonth.year, selectedMonth.month)}`);
      await exportAgendaPdf(doctorName, uniqueDays, {
        periodLabel: monthLabel(selectedMonth.year, selectedMonth.month),
        fileSuffix: selectedMonth.id,
        includeAllActivities: true,
      });
      toast.success("PDF de Agenda APS descargado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible generar el PDF de Agenda APS");
    } finally {
      setExporting(null);
    }
  }, [doctorName, exporting, selectedMonth, workbook]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Módulo EDF</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">EDF</h1>
      </header>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]"><FileText size={20} /></span>
          <div>
            <h2 className="text-base font-semibold">Formulario de Horas Administrativas</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Recuerda hacer mensualmente el formulario de SSC de horas administrativas{" "}
              <a className="font-semibold text-[var(--brand)] underline underline-offset-2" href={ADMIN_HOURS_FORM} rel="noreferrer" target="_blank">aqui</a>.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]"><CalendarDays size={20} /></span>
          <div>
            <h2 className="text-base font-semibold">Exportación mensual</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Descarga tu calendario de turnos publicados y el resumen de actividades de la Agenda APS vigente.</p>
          </div>
        </div>

        {!initialAgenda ? (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">Todavía no hay un Excel de Agenda APS vigente. La exportación de turnos sigue disponible.</p>
        ) : loading ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--muted)]"><LoaderCircle className="animate-spin" size={16} /> Leyendo el archivo vigente…</div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium text-[var(--muted)]">Médico
            <select className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--foreground)]" disabled={!doctorOptions.length} onChange={(event) => setSelectedDoctorName(event.target.value)} value={doctorName}>
              {doctorOptions.map((doctor) => <option key={`${doctor.name}-${doctor.rowIdx}`} value={doctor.name}>{doctor.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-[var(--muted)]">Mes
            <select className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm capitalize text-[var(--foreground)]" disabled={!months.length} onChange={(event) => setSelectedMonthId(event.target.value)} value={selectedMonthId}>
              {months.map((month) => <option key={month.id} value={month.id}>{monthLabel(month.year, month.month)}</option>)}
            </select>
          </label>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:mt-1" disabled={!selectedMonth || !doctorName || Boolean(exporting)} onClick={() => void exportTurnos()} type="button">
            {exporting === "turnos" ? <LoaderCircle className="animate-spin" size={17} /> : <Download size={17} />} Exportar turnos
          </button>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:mt-1" disabled={!workbook || loading || !selectedMonth || !doctorName || Boolean(exporting)} onClick={() => void exportAgenda()} type="button">
            {exporting === "agenda" ? <LoaderCircle className="animate-spin" size={17} /> : <ExternalLink size={17} />} Exportar agenda APS
          </button>
        </div>

        {workbook && !loading && !months.length ? <p className="mt-3 text-xs text-[var(--muted)]">No hay meses publicados disponibles para exportar turnos.</p> : null}
        {workbook && !loading && !workbookDoctors.length ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">No se detectaron nombres de médicos en el Excel vigente.</p> : null}
        {initialAgenda ? <p className="mt-3 text-[10px] text-[var(--muted)]">Fuente: {initialAgenda.filename} · Actualizado por {initialAgenda.updatedBy}</p> : null}
      </section>
    </div>
  );
}
