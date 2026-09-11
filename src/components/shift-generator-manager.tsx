"use client";

import { CalendarCog, LoaderCircle, Plus, Save, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  analyzeGeneratorSchedule,
  createDefaultGeneratorSettings,
  createGeneratorDraft,
  generateShiftSchedule,
  generatorMonthDates,
  generatorParticipants,
  isGeneratorWeekend,
  validateGeneratorSettings,
} from "@/lib/shift-generator";
import type {
  GeneratorAbsence,
  GeneratorAbsenceKind,
  GeneratorAssignment,
  GeneratorBalance,
  GeneratorMonthDraft,
  GeneratorSettings,
  Holiday,
  ShiftKind,
} from "@/lib/types";
import { cn, monthLabel } from "@/lib/utils";

const SPEED_LABELS = {
  fast: "Rápido",
  medium: "Medio",
  slow: "Lento",
} as const;

function currentMonthId() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function completeBalances(draft: GeneratorMonthDraft, settings: GeneratorSettings) {
  const known = new Map(draft.balances.map((balance) => [balance.participantId, balance]));
  return generatorParticipants(settings).map(
    (participant) =>
      known.get(participant.id) ?? {
        participantId: participant.id,
        total: 0,
        night: 0,
        weekend: 0,
      },
  );
}

function GeneratorCalendar({
  draft,
  settings,
  holidays,
  onChange,
}: {
  draft: GeneratorMonthDraft;
  settings: GeneratorSettings;
  holidays: Holiday[];
  onChange: (assignments: GeneratorAssignment[]) => void;
}) {
  const dates = generatorMonthDates(draft.year, draft.month);
  const leading = (new Date(`${dates[0]}T12:00:00`).getDay() + 6) % 7;
  const participants = [
    ...generatorParticipants(settings),
    {
      id: settings.wildcard.id,
      name: settings.wildcard.name,
      speed: "medium" as const,
      lane: 6,
    },
  ];
  const participantNames = new Map(participants.map((participant) => [participant.id, participant.name]));
  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const affected = new Set(draft.warnings.flatMap((warning) => warning.assignmentIds ?? []));

  function assignment(date: string, kind: ShiftKind, slot: number) {
    return draft.assignments.find(
      (item) => item.date === date && item.kind === kind && item.slot === slot,
    );
  }

  function assign(date: string, kind: ShiftKind, slot: number, participantId: string) {
    const id = `${draft.id}-${date}-${kind.toLowerCase()}-${slot}`;
    const remaining = draft.assignments.filter(
      (item) => !(item.date === date && item.kind === kind && item.slot === slot),
    );
    onChange([
      ...remaining,
      {
        id,
        date,
        kind,
        slot,
        participantId: participantId || null,
        source: "manual" as const,
      },
    ]);
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Propuesta mensual</h2>
          <p className="text-[10px] text-[var(--muted)]">
            Borrador aislado: editar aquí no modifica el calendario oficial.
          </p>
        </div>
        <span className="text-[10px] text-[var(--muted)]">
          {draft.assignments.filter((item) => item.participantId).length}/{dates.length * 5} cupos
        </span>
      </div>
      <div className="scrollbar-subtle overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-7 gap-1">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
            <div className="pb-1 text-center text-[9px] font-semibold text-[var(--muted)]" key={day}>
              {day}
            </div>
          ))}
          {Array.from({ length: leading }, (_, index) => (
            <div aria-hidden className="min-h-[112px]" key={`leading-${index}`} />
          ))}
          {dates.map((date) => {
            const special = isGeneratorWeekend(date, "DAY", holidayDates);
            return (
              <div
                className={cn(
                  "min-h-[112px] rounded-lg border border-[var(--line)] p-1",
                  special ? "bg-amber-50/60 dark:bg-amber-950/15" : "bg-[var(--surface-soft)]",
                )}
                key={date}
              >
                <div className="mb-1 flex items-center justify-between text-[9px] text-[var(--muted)]">
                  <span>{date.slice(-2)}</span>
                  {holidayDates.has(date) ? <span className="font-semibold text-amber-700">Festivo</span> : null}
                </div>
                <div className="space-y-0.5">
                  {(["DAY", "NIGHT"] as const).flatMap((kind) =>
                    Array.from({ length: kind === "DAY" ? 3 : 2 }, (_, index) => {
                      const slot = index + 1;
                      const item = assignment(date, kind, slot);
                      const invalid = affected.has(item?.id ?? `${draft.id}-${date}-${kind.toLowerCase()}-${slot}`);
                      return (
                        <div
                          className={cn(
                            kind === "NIGHT" && index === 0 && "mt-1 border-t border-[var(--shift-divider)] pt-1",
                          )}
                          key={`${kind}-${slot}`}
                        >
                          <select
                            aria-label={`${kind === "DAY" ? "Día" : "Noche"} ${slot} del ${date}`}
                            className={cn(
                              "h-[20px] w-full rounded border bg-[var(--shift-normal)] px-1 text-center text-[9px] font-semibold text-[var(--shift-normal-text)] outline-none",
                              invalid ? "border-red-500 ring-1 ring-red-400" : "border-[var(--shift-border)]",
                            )}
                            onChange={(event) => assign(date, kind, slot, event.target.value)}
                            value={item?.participantId ?? ""}
                          >
                            <option value="">— Pendiente —</option>
                            {participants.map((participant) => (
                              <option key={participant.id} value={participant.id}>
                                {participantNames.get(participant.id)}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ShiftGeneratorManager({ holidays }: { holidays: Holiday[] }) {
  const [settings, setSettings] = useState<GeneratorSettings>(createDefaultGeneratorSettings);
  const [monthId, setMonthId] = useState(currentMonthId);
  const [draft, setDraft] = useState<GeneratorMonthDraft>(() => createGeneratorDraft(currentMonthId()));
  const [loading, setLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [syncState, setSyncState] = useState<"synced" | "pending" | "saving" | "error">("synced");
  const [absenceDoctor, setAbsenceDoctor] = useState("");
  const [absenceStart, setAbsenceStart] = useState("");
  const [absenceEnd, setAbsenceEnd] = useState("");
  const [absenceKind, setAbsenceKind] = useState<GeneratorAbsenceKind>("BOTH");
  const [absenceNote, setAbsenceNote] = useState("");
  const pendingDraft = useRef<GeneratorMonthDraft | null>(null);
  const savingDraft = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftVersion = useRef(1);

  const participants = useMemo(() => generatorParticipants(settings), [settings]);
  const allParticipants = useMemo(
    () => [
      ...participants,
      {
        id: settings.wildcard.id,
        name: settings.wildcard.name,
        speed: "medium" as const,
        lane: 6,
      },
    ],
    [participants, settings.wildcard],
  );
  const names = useMemo(
    () => new Map(allParticipants.map((participant) => [participant.id, participant.name])),
    [allParticipants],
  );
  const analysis = useMemo(
    () => analyzeGeneratorSchedule({ draft, settings, holidays }),
    [draft, settings, holidays],
  );

  async function flushDraft() {
    if (savingDraft.current || !pendingDraft.current) return;
    savingDraft.current = true;
    setSyncState("saving");
    const queued = pendingDraft.current;
    pendingDraft.current = null;
    const analyzed = analyzeGeneratorSchedule({
      draft: { ...queued, version: draftVersion.current },
      settings,
      holidays,
    });
    const payload = {
      ...queued,
      version: draftVersion.current,
      generatedNotes: analyzed.generatedNotes,
      warnings: analyzed.warnings,
    };
    try {
      const response = await fetch(`/api/shift-generator/months/${payload.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; version?: number };
      if (!response.ok) throw new Error(result.error ?? "No fue posible guardar el borrador");
      draftVersion.current = result.version ?? draftVersion.current;
      setDraft((current) =>
        current.id === payload.id
          ? {
              ...current,
              version: draftVersion.current,
              generatedNotes: analyzed.generatedNotes,
              warnings: analyzed.warnings,
            }
          : current,
      );
      setSyncState(pendingDraft.current ? "pending" : "synced");
    } catch (error) {
      pendingDraft.current = queued;
      setSyncState("error");
      toast.error(error instanceof Error ? error.message : "No fue posible guardar el borrador");
    } finally {
      savingDraft.current = false;
      if (pendingDraft.current) {
        saveTimer.current = setTimeout(() => void flushDraft(), 500);
      }
    }
  }

  function queueDraft(next: GeneratorMonthDraft) {
    const analyzed = analyzeGeneratorSchedule({ draft: next, settings, holidays });
    const ready = {
      ...next,
      generatedNotes: analyzed.generatedNotes,
      warnings: analyzed.warnings,
    };
    setDraft(ready);
    pendingDraft.current = ready;
    setSyncState("pending");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushDraft(), 700);
  }

  async function load(targetMonth: string) {
    if (syncState !== "synced" && pendingDraft.current) await flushDraft();
    setLoading(true);
    try {
      const [settingsResponse, draftResponse] = await Promise.all([
        fetch("/api/shift-generator/settings"),
        fetch(`/api/shift-generator/months/${targetMonth}`),
      ]);
      const settingsResult = (await settingsResponse.json()) as GeneratorSettings & { error?: string };
      const draftResult = (await draftResponse.json()) as GeneratorMonthDraft & { error?: string };
      if (!settingsResponse.ok) throw new Error(settingsResult.error ?? "No fue posible cargar la configuración");
      if (!draftResponse.ok) throw new Error(draftResult.error ?? "No fue posible cargar el mes");
      setSettings(settingsResult);
      setSettingsDirty(false);
      const completed = { ...draftResult, balances: completeBalances(draftResult, settingsResult) };
      setDraft(completed);
      draftVersion.current = completed.version;
      pendingDraft.current = null;
      setMonthId(targetMonth);
      setAbsenceDoctor(generatorParticipants(settingsResult)[0]?.id ?? "");
      setSyncState("synced");
    } catch (error) {
      setSyncState("error");
      toast.error(error instanceof Error ? error.message : "No fue posible abrir el generador");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(monthId), 0);
    return () => {
      window.clearTimeout(initialLoad);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // Initial load only; month changes call load explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSettings() {
    const errors = validateGeneratorSettings(settings);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setSettingsSaving(true);
    try {
      const response = await fetch("/api/shift-generator/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = (await response.json()) as { error?: string; version?: number };
      if (!response.ok) throw new Error(result.error ?? "No fue posible guardar la configuración");
      setSettings((current) => ({ ...current, version: result.version ?? current.version }));
      setSettingsDirty(false);
      queueDraft({ ...draft, balances: completeBalances(draft, settings) });
      toast.success("Configuración del generador guardada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar la configuración");
    } finally {
      setSettingsSaving(false);
    }
  }

  function updateBalance(participantId: string, field: keyof Omit<GeneratorBalance, "participantId">, value: number) {
    const balances = completeBalances(draft, settings).map((balance) =>
      balance.participantId === participantId ? { ...balance, [field]: value } : balance,
    );
    queueDraft({ ...draft, balances });
  }

  function addAbsence() {
    if (!absenceDoctor || !absenceStart || !absenceEnd) {
      toast.error("Selecciona médico y rango de ausencia");
      return;
    }
    if (absenceStart > absenceEnd) {
      toast.error("La fecha final debe ser igual o posterior a la inicial");
      return;
    }
    const absence: GeneratorAbsence = {
      id: crypto.randomUUID(),
      participantId: absenceDoctor,
      startDate: absenceStart,
      endDate: absenceEnd,
      kind: absenceKind,
      note: absenceNote.trim() || undefined,
    };
    queueDraft({ ...draft, absences: [...draft.absences, absence] });
    setAbsenceNote("");
  }

  function generate() {
    const errors = validateGeneratorSettings(settings);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    if (draft.assignments.length && !window.confirm("Regenerar reemplazará la propuesta actual. ¿Continuar?")) return;
    try {
      const generated = generateShiftSchedule({
        draft: { ...draft, balances: completeBalances(draft, settings) },
        settings,
        holidays,
      });
      queueDraft(generated);
      toast.success("Propuesta mensual generada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible generar la tabla");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-[var(--muted)]">
        <LoaderCircle className="animate-spin" size={18} /> Cargando Generador Beta…
      </div>
    );
  }

  const settingErrors = validateGeneratorSettings(settings);
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-purple-300/60 bg-gradient-to-br from-purple-50/80 to-[var(--surface)] p-3 dark:border-purple-900 dark:from-purple-950/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <CalendarCog className="mt-0.5 text-purple-600" size={19} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Generador de Turnos</h2>
                <span className="rounded-full bg-purple-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Beta</span>
              </div>
              <p className="mt-0.5 max-w-2xl text-[10px] text-[var(--muted)]">
                Genera un borrador independiente. No publica ni modifica otros módulos de TurnApp.
              </p>
            </div>
          </div>
          <span className={cn(
            "rounded-full px-2 py-1 text-[9px] font-semibold",
            syncState === "error" ? "bg-red-100 text-red-700" : "bg-[var(--surface-soft)] text-[var(--muted)]",
          )}>
            {syncState === "synced" ? "Guardado" : syncState === "error" ? "Error al guardar" : "Guardando…"}
          </span>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(560px,1.35fr)_minmax(360px,.85fr)]">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Carriles clínicos</h2>
              <p className="text-[10px] text-[var(--muted)]">Seis tríos: rápido, medio y lento.</p>
            </div>
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white disabled:opacity-50"
              disabled={settingsSaving}
              onClick={saveSettings}
              type="button"
            >
              {settingsSaving ? <LoaderCircle className="animate-spin" size={14} /> : <Save size={14} />}
              Guardar configuración
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {settings.lanes.map((lane, laneIndex) => (
              <fieldset className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-2" key={lane.id}>
                <legend className="px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--brand)]">
                  Trío {lane.label}
                </legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {lane.members.map((member, memberIndex) => (
                    <label className="text-[9px] text-[var(--muted)]" key={member.id}>
                      {SPEED_LABELS[member.speed]}
                      <input
                        className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[10px] text-[var(--foreground)]"
                        onChange={(event) => {
                          setSettingsDirty(true);
                          setSettings((current) => ({
                            ...current,
                            lanes: current.lanes.map((item, index) =>
                              index === laneIndex
                                ? {
                                    ...item,
                                    members: item.members.map((currentMember, currentIndex) =>
                                      currentIndex === memberIndex
                                        ? { ...currentMember, name: event.target.value }
                                        : currentMember,
                                    ),
                                  }
                                : item,
                            ),
                          }));
                        }}
                        placeholder={SPEED_LABELS[member.speed]}
                        value={member.name}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <label className="mt-2 block rounded-xl border border-purple-300/50 bg-purple-50/50 p-2 text-[10px] text-[var(--muted)] dark:border-purple-900 dark:bg-purple-950/20">
            Médica comodín · meta 5, máximo 6
            <input
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)]"
              onChange={(event) => {
                setSettingsDirty(true);
                setSettings((current) => ({
                  ...current,
                  wildcard: { ...current.wildcard, name: event.target.value },
                }));
              }}
              placeholder="Nombre de la médica comodín"
              value={settings.wildcard.name}
            />
          </label>
          {settingErrors.length ? (
            <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-amber-700">
              <TriangleAlert size={12} /> {settingErrors[0]}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <h2 className="text-sm font-semibold">Mes y ausencias</h2>
          <div className="mt-2 grid grid-cols-[1fr_115px] gap-2">
            <label className="text-[10px] text-[var(--muted)]">
              Mes
              <input
                className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5 text-xs"
                disabled={syncState !== "synced"}
                onChange={(event) => void load(event.target.value)}
                type="month"
                value={monthId}
              />
            </label>
            <label className="text-[10px] text-[var(--muted)]">
              Trío inicial
              <select
                className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5 text-xs"
                onChange={(event) => queueDraft({ ...draft, startLane: Number(event.target.value) })}
                value={draft.startLane}
              >
                {settings.lanes.map((lane, index) => (
                  <option key={lane.id} value={index}>Trío {lane.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            <select
              aria-label="Médico ausente"
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5 text-[10px]"
              onChange={(event) => setAbsenceDoctor(event.target.value)}
              value={absenceDoctor}
            >
              <option value="">Médico</option>
              {allParticipants.map((participant) => (
                <option key={participant.id} value={participant.id}>{participant.name || "Sin nombre"}</option>
              ))}
            </select>
            <select
              aria-label="Tipo de ausencia"
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5 text-[10px]"
              onChange={(event) => setAbsenceKind(event.target.value as GeneratorAbsenceKind)}
              value={absenceKind}
            >
              <option value="BOTH">Día y noche</option>
              <option value="DAY">Sólo día</option>
              <option value="NIGHT">Sólo noche</option>
            </select>
            <input aria-label="Inicio de ausencia" className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5 text-[10px]" onChange={(event) => setAbsenceStart(event.target.value)} type="date" value={absenceStart} />
            <input aria-label="Fin de ausencia" className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5 text-[10px]" onChange={(event) => setAbsenceEnd(event.target.value)} type="date" value={absenceEnd} />
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <input
              aria-label="Nota de ausencia"
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5 text-[10px]"
              onChange={(event) => setAbsenceNote(event.target.value)}
              placeholder="Nota opcional"
              value={absenceNote}
            />
            <button aria-label="Agregar ausencia" className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand)] text-white" onClick={addAbsence} type="button">
              <Plus size={15} />
            </button>
          </div>
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {draft.absences.map((absence) => (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-soft)] px-2 py-1.5 text-[9px]" key={absence.id}>
                <strong className="min-w-0 flex-1 truncate">{names.get(absence.participantId)}</strong>
                <span>{absence.startDate} → {absence.endDate}</span>
                <span>{absence.kind === "BOTH" ? "D+N" : absence.kind === "DAY" ? "Día" : "Noche"}</span>
                <button
                  aria-label="Eliminar ausencia"
                  className="text-[var(--muted)] hover:text-red-600"
                  onClick={() => queueDraft({ ...draft, absences: draft.absences.filter((item) => item.id !== absence.id) })}
                  type="button"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {!draft.absences.length ? <p className="text-[10px] text-[var(--muted)]">Sin ausencias programadas.</p> : null}
          </div>
          <p className="mt-2 text-[9px] text-[var(--muted)]">
            Festivos leídos desde TurnApp: {holidays.filter((holiday) => holiday.date.startsWith(monthId)).length}
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Saldo previo de tres meses</h2>
            <p className="text-[10px] text-[var(--muted)]">Positivo = trabajó de más · negativo = tiene déficit.</p>
          </div>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-purple-600 px-4 text-xs font-semibold text-white disabled:opacity-50"
            disabled={settingErrors.length > 0 || settingsDirty}
            onClick={generate}
            type="button"
          >
            <Sparkles size={15} /> Generar tabla
          </button>
        </div>
        {settingsDirty ? (
          <p className="mt-1 text-right text-[9px] font-medium text-amber-700">
            Guarda la configuración antes de generar.
          </p>
        ) : null}
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-[10px]">
            <thead className="text-[var(--muted)]">
              <tr><th className="px-2 py-1 text-left">Médico</th><th>Total</th><th>Noches</th><th>FDS</th></tr>
            </thead>
            <tbody>
              {participants.map((participant) => {
                const balance = completeBalances(draft, settings).find((item) => item.participantId === participant.id)!;
                return (
                  <tr className="border-t border-[var(--line)]" key={participant.id}>
                    <th className="px-2 py-1 text-left font-semibold">{participant.name || "Sin nombre"}</th>
                    {(["total", "night", "weekend"] as const).map((field) => (
                      <td className="px-1 py-1 text-center" key={field}>
                        <input
                          aria-label={`Saldo ${field} de ${participant.name}`}
                          className="h-7 w-20 rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-1 text-center"
                          onChange={(event) => updateBalance(participant.id, field, Number(event.target.value))}
                          type="number"
                          value={balance[field]}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {draft.assignments.length ? (
        <>
          <GeneratorCalendar
            draft={{ ...draft, warnings: analysis.warnings }}
            holidays={holidays}
            onChange={(assignments) => queueDraft({ ...draft, assignments })}
            settings={settings}
          />
          <div className="grid gap-3 xl:grid-cols-2">
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <h2 className="text-sm font-semibold">Notas automáticas</h2>
              <textarea
                aria-label="Notas automáticas del generador"
                className="mt-2 min-h-64 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-2 text-[10px] leading-relaxed"
                readOnly
                value={analysis.generatedNotes}
              />
            </section>
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <h2 className="text-sm font-semibold">Notas de Jefatura</h2>
              <p className="text-[10px] text-[var(--muted)]">Texto libre guardado sólo con este borrador.</p>
              <textarea
                aria-label="Notas manuales de Jefatura"
                className="mt-2 min-h-64 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-2 text-xs leading-relaxed"
                onChange={(event) => queueDraft({ ...draft, manualNotes: event.target.value })}
                placeholder="Agrega observaciones para revisar antes de usar esta propuesta…"
                value={draft.manualNotes}
              />
            </section>
          </div>
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <div className="border-b border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
              <h2 className="text-xs font-semibold">Balance proyectado</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[10px]">
                <thead className="text-[var(--muted)]">
                  <tr><th className="px-3 py-2 text-left">Médico</th><th>Mes</th><th>Noches</th><th>FDS</th><th>Saldo total</th><th>Saldo noches</th><th>Saldo FDS</th></tr>
                </thead>
                <tbody>
                  {analysis.metrics.map((metric) => (
                    <tr className="border-t border-[var(--line)]" key={metric.participantId}>
                      <th className="px-3 py-1.5 text-left font-semibold">{names.get(metric.participantId)}</th>
                      <td className="text-center">{metric.total}</td>
                      <td className="text-center">{metric.night}</td>
                      <td className="text-center">{metric.weekend}</td>
                      <td className="text-center">{metric.projectedTotal >= 0 ? "+" : ""}{metric.projectedTotal}</td>
                      <td className="text-center">{metric.projectedNight >= 0 ? "+" : ""}{metric.projectedNight}</td>
                      <td className="text-center">{metric.projectedWeekend >= 0 ? "+" : ""}{metric.projectedWeekend}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-center">
          <CalendarCog className="mx-auto text-[var(--muted)]" size={28} />
          <p className="mt-2 text-sm font-semibold">Aún no hay una propuesta para {monthLabel(draft.year, draft.month)}</p>
          <p className="mt-1 text-[10px] text-[var(--muted)]">Completa los carriles y presiona “Generar tabla”.</p>
        </div>
      )}
    </div>
  );
}
