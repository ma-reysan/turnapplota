"use client";

import { Download, FileSpreadsheet, LoaderCircle, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { agendaDate, mergeAgendaActivities, parseAgendaWorkbook, type AgendaResult } from "@/lib/agenda-analyzer";
import { exportAgendaPdf } from "@/lib/agenda-pdf";
import type { ApsAgenda } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const MONTH_NAMES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

type AgendaTaskAssignment = {
  activity: { time: string; activity: string };
  task: string;
  dateKey: string;
  day: { label: string; date: string };
  doctorName: string;
};

function normalizedTask(activity: string) {
  const value = activity.trim().toLocaleUpperCase("es-CL");
  if (value.includes("TURNO") && !value.includes("ENTREGA")) return "Turno";
  if (value.includes("MORBILIDAD")) return "Morbilidad";
  if (value.includes("CUBRE") && value.includes("URGENCIA")) return "Cubre Urgencias";
  if (value.includes("SALA ERA")) return "Sala ERA";
  if (value.includes("CAPACITACI")) return "Capacitación";
  if (value.includes("ATENCI") && value.includes("FUNCIONARIO")) return "Atención funcionarios";
  if (value.includes("RECETA")) return "Recetas";
  if (value.includes("SALA MEDICINA")) return "Sala Medicina";
  if (value.includes("SALA CIRUG")) return "Sala Cirugía";
  if (value.includes("POSTRADO")) return "Postrados";
  if (value.includes("PALIATIVO")) return "Paliativo";
  return activity.trim();
}

function dateKeyFromAgendaDate(value: string) {
  const date = agendaDate(value);
  return date ? [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-") : "";
}

function preferredSheet(workbook: XLSX.WorkBook) {
  const currentMonth = MONTH_NAMES[new Date().getMonth()];
  return workbook.SheetNames.find((sheet) => sheet.trim().toUpperCase().startsWith(currentMonth)) ?? workbook.SheetNames.at(-1) ?? "";
}

function activityColors(activity: string) {
  const value = activity.toUpperCase();
  if (value.includes("TURNO NOCHE")) return { background: "#dbe7f1", color: "#224f70", borderColor: "#477b9f", timeBackground: "#c4d9e8", darkBackground: "#183447", darkColor: "#b9d9ea", darkBorderColor: "#4f8bad", darkTimeBackground: "#23475e" };
  if (value.includes("TURNO 24H") || value.includes("TURNO DÍA") || value.includes("TURNO DIA") || value === "TURNO" || value.includes("CUBRE TURNO")) return { background: "#f2e7c8", color: "#75571f", borderColor: "#b58b34", timeBackground: "#e8d7a7", darkBackground: "#39321f", darkColor: "#e2ce8a", darkBorderColor: "#a98b42", darkTimeBackground: "#4b4025" };
  if (value.includes("ENTREGA")) return { background: "#f4e9c5", color: "#73531f", borderColor: "#d8b862", timeBackground: "#ead9a7", darkBackground: "#39321f", darkColor: "#e2ce8a", darkBorderColor: "#a98b42", darkTimeBackground: "#4b4025" };
  if (value.includes("CARDIOVASCULAR") || value.includes("URGENCIA")) return { background: "#f3dde0", color: "#7a3540", borderColor: "#c9828e", timeBackground: "#eac9ce", darkBackground: "#39252c", darkColor: "#e3a5b5", darkBorderColor: "#ad6679", darkTimeBackground: "#4b3039" };
  if (value.includes("SALA ERA") || value.includes("CAPACITACION") || value.includes("CAPACITACIÓN")) return { background: "#d9e9f2", color: "#285b72", borderColor: "#83adbf", timeBackground: "#c5dce8", darkBackground: "#20343e", darkColor: "#a7ccdc", darkBorderColor: "#5b8da5", darkTimeBackground: "#2a4653" };
  if (value.includes("MORBILIDAD") || value.includes("RECETA")) return { background: "#dcebdd", color: "#356447", borderColor: "#8caf91", timeBackground: "#c9dfcc", darkBackground: "#23372b", darkColor: "#afd0b8", darkBorderColor: "#5d8f6d", darkTimeBackground: "#2e4838" };
  if (value.includes("ATENCION FUNCIONARIOS") || value.includes("ATENCIÓN FUNCIONARIOS")) return { background: "#d5e5df", color: "#285a4d", borderColor: "#78a394", timeBackground: "#bfd8cf", darkBackground: "#1f3934", darkColor: "#a8d3c7", darkBorderColor: "#568f80", darkTimeBackground: "#294b44" };
  if (value.includes("SALA MEDICINA") || value.includes("SALA CIRUGIA") || value.includes("SALA CIRUGÍA")) return { background: "#dfe3e5", color: "#3d4c53", borderColor: "#98a6ac", timeBackground: "#cdd4d7", darkBackground: "#293236", darkColor: "#c3d0d5", darkBorderColor: "#65777e", darkTimeBackground: "#354147" };
  if (value.includes("POSTRADO") || value.includes("PALIATIVO")) return { background: "#eadfeb", color: "#67456b", borderColor: "#aa8bad", timeBackground: "#ddcedf", darkBackground: "#342a3c", darkColor: "#cbb1d3", darkBorderColor: "#856d91", darkTimeBackground: "#44354e" };
  if (value.includes("HIPOTIROIDISMO") || value.includes("SUPERVISION") || value.includes("SUPERVISIÓN")) return { background: "#eee5cf", color: "#6d582d", borderColor: "#bea875", timeBackground: "#e2d5b9", darkBackground: "#383324", darkColor: "#d8c998", darkBorderColor: "#95804b", darkTimeBackground: "#49432e" };
  if (value.includes("REUNION") || value.includes("REUNIÓN")) return { background: "#f0dadd", color: "#793b45", borderColor: "#c88791", timeBackground: "#e5c5ca", darkBackground: "#39252c", darkColor: "#e3a5b5", darkBorderColor: "#ad6679", darkTimeBackground: "#4b3039" };
  if (value.includes("SMA")) return { background: "#f3e1d4", color: "#80482d", borderColor: "#c99576", timeBackground: "#e9cebc", darkBackground: "#3b2923", darkColor: "#e3ae94", darkBorderColor: "#b4775b", darkTimeBackground: "#4d352c" };
  if (value.includes("COLACION") || value.includes("COLACIÓN") || value.includes("ADM")) return { background: "#ecebe7", color: "#4d5355", borderColor: "#b7bbb9", timeBackground: "#deded9", darkBackground: "#2d3232", darkColor: "#d0d5d3", darkBorderColor: "#6e7976", darkTimeBackground: "#3b4241" };
  return { background: "#e4e9e7", color: "#425552", borderColor: "#a8b8b4", timeBackground: "#d3ddda", darkBackground: "#29332f", darkColor: "#c4d1cc", darkBorderColor: "#63736d", darkTimeBackground: "#36423d" };
}

function activityStyle(colors: ReturnType<typeof activityColors>) {
  return {
    "--activity-bg": colors.background,
    "--activity-color": colors.color,
    "--activity-border": colors.borderColor,
    "--activity-time-bg": colors.timeBackground,
    "--activity-dark-bg": colors.darkBackground,
    "--activity-dark-color": colors.darkColor,
    "--activity-dark-border": colors.darkBorderColor,
    "--activity-dark-time-bg": colors.darkTimeBackground,
  } as CSSProperties;
}

function ActivityCard({ activity, compact = false }: { activity: { time: string; activity: string }; compact?: boolean }) {
  const colors = activityColors(activity.activity);
  return <div className={`agenda-activity flex items-start gap-1.5 rounded-md border ${compact ? "px-2 py-1" : "px-2 py-1.5"}`} style={activityStyle(colors)}><span className="agenda-activity-time mt-px shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold">{activity.time}</span><span className="text-xs font-semibold leading-[1.3]">{activity.activity}</span></div>;
}

function ActivityChip({ activity, prefix }: { activity: { time: string; activity: string }; prefix?: string }) {
  const colors = activityColors(activity.activity);
  return <span className="agenda-activity inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold" style={activityStyle(colors)}><span className="agenda-activity-time shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold">{activity.time}</span><span className="truncate">{prefix}{activity.activity}</span></span>;
}

export function AgendaApsView({ initialAgenda }: { initialAgenda?: ApsAgenda }) {
  const [agenda, setAgenda] = useState(initialAgenda);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [result, setResult] = useState<AgendaResult | null>(null);
  const [activeSheet, setActiveSheet] = useState("");
  const [doctorRow, setDoctorRow] = useState<number | undefined>();
  const [loading, setLoading] = useState(Boolean(initialAgenda));
  const [uploading, setUploading] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showTaskSearch, setShowTaskSearch] = useState(false);
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [taskActivity, setTaskActivity] = useState("");
  const [exporting, setExporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyze = useCallback((nextWorkbook: XLSX.WorkBook, sheet: string, row?: number) => {
    const parsed = parseAgendaWorkbook(nextWorkbook, sheet, row);
    setResult(parsed); setDoctorRow(parsed?.doctorRow); setActiveSheet(sheet);
  }, []);

  const loadAgenda = useCallback(async () => {
    if (!agenda) return;
    setLoading(true);
    try {
      const response = await fetch("/api/agenda-aps?download=1");
      if (!response.ok) throw new Error("No fue posible abrir el archivo vigente");
      const workbookValue = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: "array" });
      setWorkbook(workbookValue); analyze(workbookValue, preferredSheet(workbookValue));
    } catch (error) { toast.error(error instanceof Error ? error.message : "No fue posible analizar la agenda"); }
    finally { setLoading(false); }
  }, [agenda, analyze]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAgenda(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAgenda]);
  const today = new Date(); const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const todayDay = result?.days.find((day) => { const date = agendaDate(day.date); return date && date.toDateString() === today.toDateString(); });
  const tomorrowDay = result?.days.find((day) => { const date = agendaDate(day.date); return date && date.toDateString() === tomorrow.toDateString(); });
  const shifts = useMemo(() => result?.days.flatMap((day) => mergeAgendaActivities(result.schedule[day.col] ?? []).filter((activity) => {
    const label = activity.activity.toUpperCase();
    return label.includes("TURNO") && !label.includes("ENTREGA");
  }).map((activity) => ({ ...activity, day }))) ?? [], [result]);
  const taskIndex = useMemo<AgendaTaskAssignment[]>(() => {
    if (!workbook) return [];
    return workbook.SheetNames.flatMap((sheet) => {
      const overview = parseAgendaWorkbook(workbook, sheet);
      if (!overview) return [];
      return overview.doctors.flatMap((doctor) => {
        const doctorAgenda = parseAgendaWorkbook(workbook, sheet, doctor.rowIdx);
        if (!doctorAgenda) return [];
        return doctorAgenda.days.flatMap((day) => {
          const dateKey = dateKeyFromAgendaDate(day.date);
          if (!dateKey) return [];
          return mergeAgendaActivities(doctorAgenda.schedule[day.col] ?? []).map((activity) => ({
            activity,
            task: normalizedTask(activity.activity),
            dateKey,
            day: { label: day.label, date: day.date },
            doctorName: doctor.name,
          }));
        });
      });
    });
  }, [workbook]);
  const taskOptions = useMemo(
    () => [...new Set(taskIndex.filter((item) => item.dateKey === taskDate).map((item) => item.task))].sort((a, b) => {
      if (a === "Turno") return -1;
      if (b === "Turno") return 1;
      return a.localeCompare(b, "es");
    }),
    [taskDate, taskIndex],
  );
  const selectedTaskActivity = taskOptions.includes(taskActivity) ? taskActivity : taskOptions[0] ?? "";
  const taskMatches = useMemo(
    () => taskIndex.filter((item) => item.dateKey === taskDate && item.task === selectedTaskActivity),
    [selectedTaskActivity, taskDate, taskIndex],
  );
  const warnings = useMemo(() => {
    if (!result) return [];
    return result.days.flatMap((day, index) => {
      const hasNight = result.schedule[day.col]?.some((activity) => activity.activity === "TURNO NOCHE");
      const nextDay = result.days[index + 1];
      const nextHasHandover = nextDay && result.schedule[nextDay.col]?.some((activity) => activity.activity.toUpperCase().includes("ENTREGA"));
      const isWeekend = nextDay && /SAB|SÁB|DOM/i.test(nextDay.label);
      return hasNight && (!nextDay || (!nextHasHandover && !isWeekend)) ? [nextDay ? `${nextDay.label} ${nextDay.date}` : "día siguiente"] : [];
    });
  }, [result]);

  const exportMonthlyPdf = useCallback(async () => {
    if (!workbook || !result || exporting) return;
    setExporting(true);
    try {
      const selectedName = result.doctorName.trim().toUpperCase();
      const days = workbook.SheetNames.flatMap((sheet, sheetIndex) => {
        const overview = parseAgendaWorkbook(workbook, sheet);
        const doctor = overview?.doctors.find((item) => item.name.trim().toUpperCase() === selectedName);
        if (!doctor) return [];
        const parsed = parseAgendaWorkbook(workbook, sheet, doctor.rowIdx);
        return parsed?.days.map((day, dayIndex) => ({ ...day, order: sheetIndex * 100 + dayIndex, activities: mergeAgendaActivities(parsed.schedule[day.col] ?? []) })) ?? [];
      }).sort((a, b) => {
        const dateA = agendaDate(a.date)?.getTime(); const dateB = agendaDate(b.date)?.getTime();
        return dateA !== undefined && dateB !== undefined ? dateA - dateB : a.order - b.order;
      });
      if (!days.length) throw new Error("No se encontraron días para este médico");
      await exportAgendaPdf(result.doctorName, days);
      toast.success("PDF individual descargado");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No fue posible crear el PDF"); }
    finally { setExporting(false); }
  }, [exporting, result, workbook]);

  useEffect(() => {
    const handler = () => void exportMonthlyPdf();
    window.addEventListener("turnapp:export-agenda-pdf", handler);
    return () => window.removeEventListener("turnapp:export-agenda-pdf", handler);
  }, [exportMonthlyPdf]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("updatedBy") ?? "").trim();
    if (!name || !selectedFile) return toast.error("Selecciona el Excel y escribe tu nombre");
    if (!window.confirm("¿Reemplazar la Agenda APS vigente para todo el equipo?")) return;
    data.set("file", selectedFile);
    setUploading(true);
    const response = await fetch("/api/agenda-aps", { method: "POST", body: data });
    const updated = (await response.json()) as ApsAgenda & { error?: string };
    setUploading(false);
    if (!response.ok) return toast.error(updated.error ?? "No fue posible subir la agenda");
    setAgenda(updated); setWorkbook(null); setResult(null); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; toast.success("Agenda APS actualizada");
  }

  function chooseFile(file?: File) {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) return toast.error("Selecciona un archivo Excel (.xlsx o .xls)");
    setSelectedFile(file);
  }

  return <div className="mx-auto max-w-6xl">
    <section className="mb-4 rounded-2xl bg-gradient-to-br from-emerald-900 via-teal-800 to-teal-700 p-4 text-white shadow-lg shadow-emerald-950/10">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)] lg:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Agenda APS</h1>
          <p className="mt-1.5 text-xs text-emerald-100">{agenda ? `${agenda.filename} · Actualizado el ${formatDateTime(agenda.updatedAt)} por ${agenda.updatedBy}` : "Aún no hay Agenda APS vigente."}</p>
          {agenda ? <a className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-100 underline-offset-2 hover:text-white hover:underline" href="/api/agenda-aps?download=1"><Download size={13} /> Descargar Excel</a> : null}
        </div>
        <form className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm" onSubmit={upload}>
          <input accept=".xlsx,.xls" className="sr-only" name="file" onChange={(event) => chooseFile(event.target.files?.[0])} ref={fileInputRef} type="file" />
          <button aria-label="Seleccionar archivo Excel" className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-center text-xs font-semibold transition ${dragging ? "border-white bg-white/25" : "border-white/50 bg-white/10 hover:border-white hover:bg-white/20"}`} onClick={() => fileInputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }} type="button"><FileSpreadsheet size={18} /><span>{selectedFile ? selectedFile.name : "¿Dra. Rojas mandó una agenda nueva? Colocala aqui 👇"}</span></button>
          <label className="mt-2 block text-[10px] font-medium text-emerald-100">¿Quién está subiendo el archivo?</label>
          <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]"><input className="min-w-0 rounded-lg border border-white/25 bg-white/95 px-2.5 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-500" name="updatedBy" placeholder="¿Dr/Dra...?" required /><button className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 disabled:opacity-60" disabled={uploading} type="submit">{uploading ? "Subiendo…" : "Actualizar"}</button></div>
        </form>
      </div>
    </section>
    {!agenda ? <div className="grid min-h-56 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-center"><FileSpreadsheet size={30} className="text-[var(--muted)]" /><p className="text-sm text-[var(--muted)]">Sube la primera agenda semanal para activar el analizador.</p></div> : loading ? <div className="grid min-h-56 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)]"><LoaderCircle className="animate-spin text-[var(--brand)]" /><p className="text-sm text-[var(--muted)]">Leyendo la agenda vigente…</p></div> : result ? <><section className="mb-3 grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 md:grid-cols-[minmax(180px,1.2fr)_minmax(150px,1fr)_auto] md:items-end"><label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Médico<select className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-2 text-sm font-semibold normal-case tracking-normal text-[var(--foreground)]" onChange={(event) => workbook && analyze(workbook, activeSheet, Number(event.target.value))} value={doctorRow}>{result.doctors.map((doctor) => <option key={doctor.rowIdx} value={doctor.rowIdx}>{doctor.name}</option>)}</select></label>{workbook && workbook.SheetNames.length > 1 ? <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Mes<select className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-2 text-sm font-semibold normal-case tracking-normal text-[var(--foreground)]" onChange={(event) => workbook && analyze(workbook, event.target.value)} value={activeSheet}>{workbook.SheetNames.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}</select></label> : <div /> }<div className="flex flex-wrap gap-2"><button className={`rounded-lg border px-3 py-2 text-xs font-semibold ${showOverview ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)]"}`} onClick={() => setShowOverview((value) => !value)} type="button">Mostrar turnos y hoy/mañana</button><button className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${showTaskSearch ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)]"}`} onClick={() => setShowTaskSearch((value) => !value)} type="button"><Search size={14} /> Buscador de tareas</button></div></section>{showTaskSearch ? <TaskFinder activity={selectedTaskActivity} matches={taskMatches} onActivityChange={setTaskActivity} onDateChange={setTaskDate} options={taskOptions} selectedDate={taskDate} /> : null}{showOverview ? <AgendaOverview shifts={shifts} todayDay={todayDay} tomorrowDay={tomorrowDay} result={result} /> : null}{warnings.length ? <div className="mb-3 grid gap-1.5">{warnings.map((day) => <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200" key={day}>⚠️ Falta una entrega de turno el día <strong>{day}</strong>.</p>)}</div> : null}<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{result.days.map((day) => <article className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3" key={day.col}><h3 className="border-b border-[var(--line)] pb-1 text-xs font-bold uppercase">{day.label} <span className="font-normal text-[var(--muted)]">{day.date}</span></h3><div className="mt-2 grid gap-1">{mergeAgendaActivities(result.schedule[day.col] ?? []).length ? mergeAgendaActivities(result.schedule[day.col] ?? []).map((activity, index) => <ActivityCard activity={activity} key={index} compact />) : <p className="py-3 text-center text-xs italic text-[var(--muted)]">Libre / Sin actividades</p>}</div></article>)}</div></> : <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">No se detectaron médicos en la agenda vigente.</div>}
  </div>;
}

function AgendaOverview({
  shifts,
  todayDay,
  tomorrowDay,
  result,
}: {
  shifts: Array<{ time: string; activity: string; day: { col: number; label: string; date: string } }>;
  todayDay?: { col: number; label: string; date: string };
  tomorrowDay?: { col: number; label: string; date: string };
  result: AgendaResult;
}) {
  const todayActivities = todayDay ? mergeAgendaActivities(result.schedule[todayDay.col] ?? []) : [];
  const tomorrowActivities = tomorrowDay ? mergeAgendaActivities(result.schedule[tomorrowDay.col] ?? []) : [];

  return <section className="mb-3 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] md:grid md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
    <div className="border-b border-[var(--line)] p-3 md:border-b-0 md:border-r">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">Turnos</h2>
      <div className="mt-2 grid justify-items-start gap-1.5">
        {shifts.length ? shifts.map((shift, index) => <ActivityChip activity={shift} key={index} prefix={`${shift.day.label} ${shift.day.date} · `} />) : <p className="text-xs text-[var(--muted)]">No hay turnos programados.</p>}
      </div>
    </div>
    <div className="grid md:grid-rows-2">
      <OverviewDay activities={todayActivities} day={todayDay} label="Hoy" />
      <OverviewDay activities={tomorrowActivities} day={tomorrowDay} label="Mañana" withTopBorder />
    </div>
  </section>;
}

function OverviewDay({
  activities,
  day,
  label,
  withTopBorder = false,
}: {
  activities: Array<{ time: string; activity: string }>;
  day?: { label: string; date: string };
  label: string;
  withTopBorder?: boolean;
}) {
  return <div className={`p-3 ${withTopBorder ? "border-t border-[var(--line)]" : ""}`}>
    <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">{label}{day ? ` · ${day.label} ${day.date}` : ""}</h2>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {activities.length ? activities.map((activity, index) => <ActivityChip activity={activity} key={index} />) : <p className="text-xs text-[var(--muted)]">Sin actividades programadas.</p>}
    </div>
  </div>;
}


function TaskFinder({
  activity,
  matches,
  onActivityChange,
  onDateChange,
  options,
  selectedDate,
}: {
  activity: string;
  matches: AgendaTaskAssignment[];
  onActivityChange: (value: string) => void;
  onDateChange: (value: string) => void;
  options: string[];
  selectedDate: string;
}) {
  return <section className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
    <div className="mb-2 flex items-center gap-2"><Search className="text-[var(--brand)]" size={16} /><div><h2 className="text-xs font-semibold uppercase tracking-wider">BUSCADOR DE TAREAS</h2><p className="text-[11px] text-[var(--muted)]">¿A quién le toca hoy...?</p></div></div>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
      <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Tarea<select className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-2 text-sm font-semibold normal-case tracking-normal text-[var(--foreground)]" disabled={!options.length} onChange={(event) => onActivityChange(event.target.value)} value={activity}>{options.length ? options.map((option) => <option key={option} value={option}>{option}</option>) : <option>No hay tareas para esta fecha</option>}</select></label>
      <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Día<input className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-2 text-sm font-semibold normal-case tracking-normal text-[var(--foreground)]" onChange={(event) => onDateChange(event.target.value)} type="date" value={selectedDate} /></label>
    </div>
    <div className="mt-3">{activity && matches.length ? <div className="agenda-activity overflow-hidden rounded-lg border" style={activityStyle(activityColors(activity))}><div className="border-b border-current/20 px-3 py-2 text-[10px] font-bold uppercase tracking-[.16em]">Resultado · {activity}</div><div className="grid divide-y divide-current/15">{matches.map((match, index) => <div className="flex items-center justify-between gap-3 px-3 py-2.5" key={match.doctorName + match.activity.time + index}><strong className="text-sm">{match.doctorName}</strong><span className="text-right text-[11px] font-medium opacity-80">{activity === "Turno" ? <>{match.activity.time} · {match.activity.activity}</> : match.activity.time}</span></div>)}</div></div> : <div className="rounded-lg bg-[var(--surface-soft)] px-3 py-2.5"><p className="text-xs text-[var(--muted)]">{options.length ? "No se encontró un médico asignado a esa tarea." : "No hay actividades registradas para ese día."}</p></div>}</div>
  </section>;
}
