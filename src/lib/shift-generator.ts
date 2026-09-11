import type {
  GeneratorAbsence,
  GeneratorAssignment,
  GeneratorBalance,
  GeneratorLaneSpeed,
  GeneratorMetric,
  GeneratorMonthDraft,
  GeneratorParticipant,
  GeneratorSettings,
  GeneratorWarning,
  Holiday,
  ShiftKind,
} from "@/lib/types";

const SPEEDS: GeneratorLaneSpeed[] = ["fast", "medium", "slow"];

export function createDefaultGeneratorSettings(): GeneratorSettings {
  return {
    id: "default",
    version: 1,
    lanes: Array.from({ length: 6 }, (_, lane) => ({
      id: `lane-${lane}`,
      label: String.fromCharCode(65 + lane),
      members: SPEEDS.map((speed) => ({
        id: `lane-${lane}-${speed}`,
        name: "",
        speed,
        lane,
      })),
    })),
    wildcard: { id: "wildcard", name: "", target: 5, max: 6 },
  };
}

export function createGeneratorDraft(id: string, startLane = 0): GeneratorMonthDraft {
  const [year, month] = id.split("-").map(Number);
  return {
    id,
    year,
    month,
    startLane,
    absences: [],
    balances: [],
    assignments: [],
    generatedNotes: "",
    manualNotes: "",
    warnings: [],
    version: 1,
  };
}

export function generatorParticipants(settings: GeneratorSettings) {
  return settings.lanes.flatMap((lane) => lane.members);
}

export function validateGeneratorSettings(settings: GeneratorSettings) {
  const regular = generatorParticipants(settings);
  const names = [...regular.map((participant) => participant.name.trim()), settings.wildcard.name.trim()];
  const normalized = names.map((name) => name.toLocaleLowerCase("es-CL"));
  const errors: string[] = [];
  if (settings.lanes.length !== 6 || regular.length !== 18) {
    errors.push("Deben existir seis tríos con tres médicos cada uno.");
  }
  if (names.some((name) => !name)) errors.push("Completa los 18 nombres y la médica comodín.");
  if (new Set(normalized.filter(Boolean)).size !== normalized.filter(Boolean).length) {
    errors.push("Los nombres deben ser únicos.");
  }
  if (settings.wildcard.target !== 5 || settings.wildcard.max !== 6) {
    errors.push("La comodín debe conservar meta 5 y máximo 6.");
  }
  return errors;
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addCalendarDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return dateKey(value);
}

export function generatorMonthDates(year: number, month: number) {
  const count = new Date(year, month, 0, 12).getDate();
  return Array.from({ length: count }, (_, index) =>
    `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
  );
}

export function isGeneratorWeekend(
  date: string,
  kind: ShiftKind,
  holidayDates: Set<string>,
) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return holidayDates.has(date) || weekday === 0 || weekday === 6 || (weekday === 5 && kind === "NIGHT");
}

function wildcardWindow(date: string, kind: ShiftKind) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return (weekday === 5 && kind === "NIGHT")
    || (weekday === 6 && (kind === "DAY" || kind === "NIGHT"))
    || (weekday === 0 && kind === "DAY");
}

function absenceBlocks(absence: GeneratorAbsence, date: string, kind: ShiftKind) {
  return absence.startDate <= date
    && absence.endDate >= date
    && (absence.kind === "BOTH" || absence.kind === kind);
}

function isAbsent(absences: GeneratorAbsence[], participantId: string, date: string, kind: ShiftKind) {
  return absences.some(
    (absence) => absence.participantId === participantId && absenceBlocks(absence, date, kind),
  );
}

function assignmentId(monthId: string, date: string, kind: ShiftKind, slot: number) {
  return `${monthId}-${date}-${kind.toLowerCase()}-${slot}`;
}

function balanceMap(balances: GeneratorBalance[]) {
  return new Map(balances.map((balance) => [balance.participantId, balance]));
}

function countFor(
  assignments: GeneratorAssignment[],
  participantId: string,
  holidayDates: Set<string>,
) {
  const own = assignments.filter((assignment) => assignment.participantId === participantId);
  return {
    total: own.length,
    night: own.filter((assignment) => assignment.kind === "NIGHT").length,
    weekend: own.filter((assignment) => isGeneratorWeekend(assignment.date, assignment.kind, holidayDates)).length,
  };
}

function workedOn(assignments: GeneratorAssignment[], participantId: string, date: string) {
  return assignments.some(
    (assignment) => assignment.participantId === participantId && assignment.date === date,
  );
}

function consecutiveWorkedDays(
  assignments: GeneratorAssignment[],
  participantId: string,
  date: string,
) {
  let streak = workedOn(assignments, participantId, date) ? 1 : 0;
  for (let offset = 1; offset <= 10; offset += 1) {
    if (!workedOn(assignments, participantId, addCalendarDays(date, -offset))) break;
    streak += 1;
  }
  return streak;
}

function precedingNights(
  assignments: GeneratorAssignment[],
  participantId: string,
  date: string,
) {
  let streak = 0;
  for (let offset = 1; offset <= 10; offset += 1) {
    const target = addCalendarDays(date, -offset);
    if (!assignments.some(
      (assignment) =>
        assignment.participantId === participantId
        && assignment.date === target
        && assignment.kind === "NIGHT",
    )) break;
    streak += 1;
  }
  return streak;
}

function hasNextDayAssignment(
  assignments: GeneratorAssignment[],
  participantId: string,
  date: string,
  kind: ShiftKind,
) {
  if (kind !== "NIGHT") return false;
  const next = addCalendarDays(date, 1);
  return assignments.some(
    (assignment) =>
      assignment.participantId === participantId
      && assignment.date === next
      && assignment.kind === "DAY",
  );
}

function alreadyInShift(
  assignments: GeneratorAssignment[],
  participantId: string,
  date: string,
  kind: ShiftKind,
) {
  return assignments.some(
    (assignment) =>
      assignment.participantId === participantId
      && assignment.date === date
      && assignment.kind === kind,
  );
}

function deterministicRank(participant: GeneratorParticipant, year: number, month: number) {
  const all = participant.lane * 3 + SPEEDS.indexOf(participant.speed);
  return (all - ((year * 12 + month) % 18) + 18) % 18;
}

function compareTuple(first: number[], second: number[]) {
  for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
    const difference = (first[index] ?? 0) - (second[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function weekendGroup(date: string) {
  const value = new Date(`${date}T12:00:00`);
  const weekday = value.getDay();
  const fridayOffset = weekday === 0 ? -2 : 5 - weekday;
  value.setDate(value.getDate() + fridayOffset);
  return dateKey(value);
}

function generatedAssignment(
  monthId: string,
  date: string,
  kind: ShiftKind,
  slot: number,
  participantId: string | null,
  source: GeneratorAssignment["source"],
): GeneratorAssignment {
  return { id: assignmentId(monthId, date, kind, slot), date, kind, slot, participantId, source };
}

type GeneratorLoad = { total: number; night: number; weekend: number };

function expectedLoads(
  regular: GeneratorParticipant[],
  draft: GeneratorMonthDraft,
  assignments: GeneratorAssignment[],
  holidayDates: Set<string>,
  wildcardId: string,
) {
  const dates = generatorMonthDates(draft.year, draft.month);
  const wildcard = assignments.filter((assignment) => assignment.participantId === wildcardId);
  const slots: GeneratorLoad = {
    total: dates.length * 5 - wildcard.length,
    night: dates.length * 2 - wildcard.filter((assignment) => assignment.kind === "NIGHT").length,
    weekend: dates.reduce((sum, date) =>
      sum
      + (isGeneratorWeekend(date, "DAY", holidayDates) ? 3 : 0)
      + (isGeneratorWeekend(date, "NIGHT", holidayDates) ? 2 : 0), 0)
      - wildcard.filter((assignment) => isGeneratorWeekend(assignment.date, assignment.kind, holidayDates)).length,
  };
  const availability = new Map<string, GeneratorLoad>();
  for (const participant of regular) {
    const load = dates.reduce<GeneratorLoad>((result, date) => {
      const day = isAbsent(draft.absences, participant.id, date, "DAY") ? 0 : 1;
      const night = isAbsent(draft.absences, participant.id, date, "NIGHT") ? 0 : 1;
      return {
        total: result.total + day + night,
        night: result.night + night,
        weekend: result.weekend
          + (day && isGeneratorWeekend(date, "DAY", holidayDates) ? 1 : 0)
          + (night && isGeneratorWeekend(date, "NIGHT", holidayDates) ? 1 : 0),
      };
    }, { total: 0, night: 0, weekend: 0 });
    availability.set(participant.id, load);
  }
  const availabilityTotals = [...availability.values()].reduce<GeneratorLoad>(
    (result, load) => ({
      total: result.total + load.total,
      night: result.night + load.night,
      weekend: result.weekend + load.weekend,
    }),
    { total: 0, night: 0, weekend: 0 },
  );
  return new Map(regular.map((participant) => {
    const available = availability.get(participant.id)!;
    return [participant.id, {
      total: availabilityTotals.total ? slots.total * available.total / availabilityTotals.total : 0,
      night: availabilityTotals.night ? slots.night * available.night / availabilityTotals.night : 0,
      weekend: availabilityTotals.weekend ? slots.weekend * available.weekend / availabilityTotals.weekend : 0,
    }];
  }));
}

function candidateBaseScore(
  participant: GeneratorParticipant,
  assignments: GeneratorAssignment[],
  balances: Map<string, GeneratorBalance>,
  expected: Map<string, GeneratorLoad>,
  holidayDates: Set<string>,
  year: number,
  month: number,
) {
  const current = countFor(assignments, participant.id, holidayDates);
  const prior = balances.get(participant.id) ?? { total: 0, night: 0, weekend: 0 };
  const target = expected.get(participant.id) ?? { total: 0, night: 0, weekend: 0 };
  return {
    total: prior.total + current.total - target.total,
    night: prior.night + current.night - target.night,
    weekend: prior.weekend + current.weekend - target.weekend,
    rank: deterministicRank(participant, year, month),
  };
}

function repeatedPairCount(
  assignments: GeneratorAssignment[],
  participantId: string,
  date: string,
) {
  const partner = assignments.find(
    (assignment) =>
      assignment.date === date
      && assignment.kind === "NIGHT"
      && assignment.participantId
      && assignment.participantId !== participantId,
  )?.participantId;
  if (!partner) return 0;
  const participantNights = new Set(assignments
    .filter((assignment) => assignment.kind === "NIGHT" && assignment.participantId === participantId)
    .map((assignment) => assignment.date));
  return assignments.filter(
    (assignment) =>
      assignment.kind === "NIGHT"
      && assignment.participantId === partner
      && participantNights.has(assignment.date),
  ).length;
}

function regularEligible(
  participant: GeneratorParticipant,
  assignments: GeneratorAssignment[],
  absences: GeneratorAbsence[],
  date: string,
  kind: ShiftKind,
) {
  return !isAbsent(absences, participant.id, date, kind)
    && !alreadyInShift(assignments, participant.id, date, kind)
    && !hasNextDayAssignment(assignments, participant.id, date, kind);
}

function insertAssignment(
  assignments: GeneratorAssignment[],
  assignment: GeneratorAssignment,
) {
  const index = assignments.findIndex(
    (item) =>
      item.date === assignment.date
      && item.kind === assignment.kind
      && item.slot === assignment.slot,
  );
  if (index >= 0) assignments[index] = assignment;
  else assignments.push(assignment);
}

export function analyzeGeneratorSchedule({
  draft,
  settings,
  holidays,
}: {
  draft: GeneratorMonthDraft;
  settings: GeneratorSettings;
  holidays: Holiday[];
}) {
  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const participants = [...generatorParticipants(settings), {
    id: settings.wildcard.id,
    name: settings.wildcard.name,
    speed: "medium" as const,
    lane: 6,
  }];
  const names = new Map(participants.map((participant) => [participant.id, participant.name]));
  const warnings: GeneratorWarning[] = [];
  const dates = generatorMonthDates(draft.year, draft.month);
  const assignments = draft.assignments;

  for (const date of dates) {
    for (const [kind, slots] of [["DAY", 3], ["NIGHT", 2]] as const) {
      for (let slot = 1; slot <= slots; slot += 1) {
        const assignment = assignments.find(
          (item) => item.date === date && item.kind === kind && item.slot === slot,
        );
        if (!assignment?.participantId) {
          warnings.push({
            code: "EMPTY_SLOT",
            date,
            assignmentIds: [assignmentId(draft.id, date, kind, slot)],
            message: `Cupo pendiente: ${date}, ${kind === "DAY" ? "día" : "noche"} ${slot}.`,
          });
        }
      }
    }
  }

  for (const assignment of assignments.filter((item) => item.participantId)) {
    const participantId = assignment.participantId!;
    if (isAbsent(draft.absences, participantId, assignment.date, assignment.kind)) {
      warnings.push({
        code: "ABSENCE_CONFLICT",
        date: assignment.date,
        assignmentIds: [assignment.id],
        message: `${names.get(participantId) ?? participantId} está asignado durante una ausencia.`,
      });
    }
    if (participantId === settings.wildcard.id && !wildcardWindow(assignment.date, assignment.kind)) {
      warnings.push({
        code: "WILDCARD_WINDOW",
        date: assignment.date,
        assignmentIds: [assignment.id],
        message: `La comodín quedó fuera de su ventana contractual el ${assignment.date}.`,
      });
    }
  }

  for (const date of dates) {
    for (const kind of ["DAY", "NIGHT"] as const) {
      const shift = assignments.filter(
        (assignment) => assignment.date === date && assignment.kind === kind && assignment.participantId,
      );
      const seen = new Set<string>();
      for (const assignment of shift) {
        if (seen.has(assignment.participantId!)) {
          warnings.push({
            code: "DUPLICATE_SHIFT",
            date,
            assignmentIds: shift.filter((item) => item.participantId === assignment.participantId).map((item) => item.id),
            message: `${names.get(assignment.participantId!) ?? assignment.participantId} está repetido en el mismo turno.`,
          });
        }
        seen.add(assignment.participantId!);
      }
    }
  }

  for (const assignment of assignments.filter(
    (item) => item.kind === "NIGHT" && item.participantId,
  )) {
    const next = addCalendarDays(assignment.date, 1);
    const nextDay = assignments.find(
      (item) =>
        item.kind === "DAY"
        && item.date === next
        && item.participantId === assignment.participantId,
    );
    if (nextDay) {
      warnings.push({
        code: "POST_SHIFT",
        date: assignment.date,
        assignmentIds: [assignment.id, nextDay.id],
        message: `${names.get(assignment.participantId!) ?? assignment.participantId} tiene noche y día siguiente.`,
      });
    }
  }

  const wildcardAssignments = assignments.filter(
    (assignment) => assignment.participantId === settings.wildcard.id,
  );
  if (wildcardAssignments.length > settings.wildcard.max) {
    warnings.push({
      code: "WILDCARD_MAX",
      message: `La comodín supera su máximo de ${settings.wildcard.max} turnos.`,
      assignmentIds: wildcardAssignments.map((item) => item.id),
    });
  }
  const wildcardGroups = new Map<string, GeneratorAssignment[]>();
  for (const assignment of wildcardAssignments) {
    const group = weekendGroup(assignment.date);
    wildcardGroups.set(group, [...(wildcardGroups.get(group) ?? []), assignment]);
  }
  for (const [group, groupAssignments] of wildcardGroups) {
    if (groupAssignments.length > 2) {
      warnings.push({
        code: "WILDCARD_WEEKEND_MAX",
        date: group,
        assignmentIds: groupAssignments.map((item) => item.id),
        message: `La comodín supera dos turnos en el fin de semana del ${group}.`,
      });
    }
  }

  for (const participant of participants) {
    let workStreak = 0;
    let nightStreak = 0;
    for (const date of dates) {
      const works = assignments.some((item) => item.participantId === participant.id && item.date === date);
      const night = assignments.some((item) => item.participantId === participant.id && item.date === date && item.kind === "NIGHT");
      workStreak = works ? workStreak + 1 : 0;
      nightStreak = night ? nightStreak + 1 : 0;
      if (workStreak === 4) {
        warnings.push({ code: "WORK_STREAK", date, message: `${participant.name} acumula más de tres días trabajados.` });
      }
      if (nightStreak === 3) {
        warnings.push({ code: "NIGHT_STREAK", date, message: `${participant.name} acumula más de dos noches consecutivas.` });
      }
    }
  }

  const balances = balanceMap(draft.balances);
  const regular = generatorParticipants(settings);
  const expected = expectedLoads(regular, draft, assignments, holidayDates, settings.wildcard.id);
  const round = (value: number) => Math.round(value * 10) / 10;
  const metrics: GeneratorMetric[] = participants.map((participant) => {
    const current = countFor(assignments, participant.id, holidayDates);
    const previous = balances.get(participant.id) ?? {
      participantId: participant.id,
      total: 0,
      night: 0,
      weekend: 0,
    };
    const target = expected.get(participant.id);
    return {
      participantId: participant.id,
      ...current,
      projectedTotal: round(previous.total + current.total - (target?.total ?? (participant.id === settings.wildcard.id ? settings.wildcard.target : 0))),
      projectedNight: round(previous.night + current.night - (target?.night ?? 0)),
      projectedWeekend: round(previous.weekend + current.weekend - (target?.weekend ?? 0)),
    };
  });

  const absenceLines = draft.absences.map((absence) =>
    `- ${names.get(absence.participantId) ?? absence.participantId}: ${absence.startDate} a ${absence.endDate} (${absence.kind === "BOTH" ? "día y noche" : absence.kind === "DAY" ? "día" : "noche"})${absence.note ? ` — ${absence.note}` : ""}`,
  );
  const metricLines = metrics.map((metric) =>
    `- ${names.get(metric.participantId) ?? metric.participantId}: ${metric.total} turnos, ${metric.night} noches, ${metric.weekend} FDS; saldos proyectados ${metric.projectedTotal >= 0 ? "+" : ""}${metric.projectedTotal}/${metric.projectedNight >= 0 ? "+" : ""}${metric.projectedNight}/${metric.projectedWeekend >= 0 ? "+" : ""}${metric.projectedWeekend}.`,
  );
  const warningLines = warnings.length
    ? warnings.map((warning) => `- ${warning.message}`)
    : ["- No se detectaron excepciones ni incompatibilidades."];

  const generatedNotes = [
    "CRITERIO APLICADO",
    "- Días por rotación de tríos A–F; reemplazos priorizados por carril y saldo.",
    "- FDS incluye viernes noche, sábado, domingo y festivos.",
    "- La comodín tiene meta 5, máximo 6 y sólo usa sus ventanas contractuales.",
    "",
    "AUSENCIAS",
    ...(absenceLines.length ? absenceLines : ["- Sin ausencias programadas."]),
    "",
    "EXCEPCIONES Y REVISIÓN",
    ...warningLines,
    "",
    "RESUMEN DE CARGA (total/noches/FDS)",
    ...metricLines,
  ].join("\n");

  return { warnings, metrics, generatedNotes };
}

export function generateShiftSchedule({
  draft,
  settings,
  holidays,
}: {
  draft: GeneratorMonthDraft;
  settings: GeneratorSettings;
  holidays: Holiday[];
}): GeneratorMonthDraft {
  const settingsErrors = validateGeneratorSettings(settings);
  if (settingsErrors.length) throw new Error(settingsErrors[0]);

  const regular = generatorParticipants(settings);
  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const balances = balanceMap(draft.balances);
  const dates = generatorMonthDates(draft.year, draft.month);
  const assignments: GeneratorAssignment[] = [];

  // 1. Diurnal skeleton: one balanced trio per day.
  dates.forEach((date, dayIndex) => {
    const laneIndex = (draft.startLane + dayIndex) % 6;
    const lane = settings.lanes[laneIndex];
    lane.members.forEach((participant, memberIndex) => {
      insertAssignment(
        assignments,
        generatedAssignment(
          draft.id,
          date,
          "DAY",
          memberIndex + 1,
          isAbsent(draft.absences, participant.id, date, "DAY") ? null : participant.id,
          "rotation",
        ),
      );
    });
  });

  // 2. Place the wildcard across as many weekends as possible, prioritizing genuine gaps.
  const wildcardSlots = dates.flatMap((date) => {
    const options: Array<{ date: string; kind: ShiftKind; slot: number; gap: boolean }> = [];
    if (wildcardWindow(date, "DAY")) {
      const dayGap = assignments.find(
        (assignment) => assignment.date === date && assignment.kind === "DAY" && !assignment.participantId,
      );
      if (dayGap) options.push({ date, kind: "DAY", slot: dayGap.slot, gap: true });
    }
    if (wildcardWindow(date, "NIGHT")) {
      options.push({ date, kind: "NIGHT", slot: 1, gap: false });
    }
    return options;
  });
  const groups = [...new Set(wildcardSlots.map((slot) => weekendGroup(slot.date)))];
  let wildcardCount = 0;
  for (const pass of [1, 2]) {
    for (const group of groups) {
      if (wildcardCount >= settings.wildcard.target) break;
      const groupAssignments = assignments.filter(
        (assignment) =>
          assignment.participantId === settings.wildcard.id
          && weekendGroup(assignment.date) === group,
      );
      if (groupAssignments.length >= pass || groupAssignments.length >= 2) continue;
      const candidates = wildcardSlots
        .filter((slot) => weekendGroup(slot.date) === group)
        .filter((slot) => !isAbsent(draft.absences, settings.wildcard.id, slot.date, slot.kind))
        .filter((slot) => !alreadyInShift(assignments, settings.wildcard.id, slot.date, slot.kind))
        .filter((slot) => !hasNextDayAssignment(assignments, settings.wildcard.id, slot.date, slot.kind))
        .filter((slot) => {
          const existing = assignments.find(
            (assignment) =>
              assignment.date === slot.date
              && assignment.kind === slot.kind
              && assignment.slot === slot.slot,
          );
          return !existing?.participantId;
        })
        .sort((first, second) =>
          Number(second.gap) - Number(first.gap)
          || first.date.localeCompare(second.date)
          || first.kind.localeCompare(second.kind),
        );
      const chosen = candidates[0];
      if (!chosen) continue;
      insertAssignment(
        assignments,
        generatedAssignment(draft.id, chosen.date, chosen.kind, chosen.slot, settings.wildcard.id, "wildcard"),
      );
      wildcardCount += 1;
    }
  }

  const expected = expectedLoads(regular, draft, assignments, holidayDates, settings.wildcard.id);

  // 3. Fill absences in the diurnal skeleton.
  for (const date of dates) {
    const lane = settings.lanes[(draft.startLane + Number(date.slice(-2)) - 1) % 6];
    for (let slot = 1; slot <= 3; slot += 1) {
      const current = assignments.find(
        (assignment) => assignment.date === date && assignment.kind === "DAY" && assignment.slot === slot,
      );
      if (current?.participantId) continue;
      const desiredSpeed = lane.members[slot - 1]?.speed;
      const candidates = regular
        .filter((participant) => regularEligible(participant, assignments, draft.absences, date, "DAY"))
        .sort((first, second) => {
          const firstLoad = candidateBaseScore(first, assignments, balances, expected, holidayDates, draft.year, draft.month);
          const secondLoad = candidateBaseScore(second, assignments, balances, expected, holidayDates, draft.year, draft.month);
          return compareTuple(
            [
              first.speed === desiredSpeed ? 0 : 1,
              firstLoad.total,
              isGeneratorWeekend(date, "DAY", holidayDates) ? firstLoad.weekend : 0,
              consecutiveWorkedDays(assignments, first.id, date),
              firstLoad.rank,
            ],
            [
              second.speed === desiredSpeed ? 0 : 1,
              secondLoad.total,
              isGeneratorWeekend(date, "DAY", holidayDates) ? secondLoad.weekend : 0,
              consecutiveWorkedDays(assignments, second.id, date),
              secondLoad.rank,
            ],
          );
        });
      if (candidates[0]) {
        insertAssignment(
          assignments,
          generatedAssignment(draft.id, date, "DAY", slot, candidates[0].id, "replacement"),
        );
      }
    }
  }

  // 4. Fill all night slots while respecting post-shift and absences.
  for (const date of dates) {
    for (let slot = 1; slot <= 2; slot += 1) {
      const current = assignments.find(
        (assignment) => assignment.date === date && assignment.kind === "NIGHT" && assignment.slot === slot,
      );
      if (current?.participantId) continue;
      const eligible = regular.filter(
        (participant) => regularEligible(participant, assignments, draft.absences, date, "NIGHT"),
      );
      const special = isGeneratorWeekend(date, "NIGHT", holidayDates);
      const minimumWeekend = eligible.reduce((minimum, participant) => {
        const load = candidateBaseScore(participant, assignments, balances, expected, holidayDates, draft.year, draft.month);
        return Math.min(minimum, load.weekend);
      }, Number.POSITIVE_INFINITY);
      eligible.sort((first, second) => {
        const firstLoad = candidateBaseScore(first, assignments, balances, expected, holidayDates, draft.year, draft.month);
        const secondLoad = candidateBaseScore(second, assignments, balances, expected, holidayDates, draft.year, draft.month);
        const firstWorkedDay = assignments.some(
          (assignment) => assignment.date === date && assignment.kind === "DAY" && assignment.participantId === first.id,
        );
        const secondWorkedDay = assignments.some(
          (assignment) => assignment.date === date && assignment.kind === "DAY" && assignment.participantId === second.id,
        );
        const firstContinuity = special && firstWorkedDay && firstLoad.weekend + 1 <= minimumWeekend + 1 ? 0 : special ? 1 : 0;
        const secondContinuity = special && secondWorkedDay && secondLoad.weekend + 1 <= minimumWeekend + 1 ? 0 : special ? 1 : 0;
        const firstDayPenalty = !special && firstWorkedDay ? 1 : 0;
        const secondDayPenalty = !special && secondWorkedDay ? 1 : 0;
        return compareTuple(
          [
            special ? firstContinuity : firstDayPenalty,
            special ? firstLoad.weekend : firstLoad.night,
            firstLoad.night,
            firstLoad.total,
            precedingNights(assignments, first.id, date) >= 2 ? 1 : 0,
            consecutiveWorkedDays(assignments, first.id, date) >= 3 ? 1 : 0,
            repeatedPairCount(assignments, first.id, date),
            firstLoad.rank,
          ],
          [
            special ? secondContinuity : secondDayPenalty,
            special ? secondLoad.weekend : secondLoad.night,
            secondLoad.night,
            secondLoad.total,
            precedingNights(assignments, second.id, date) >= 2 ? 1 : 0,
            consecutiveWorkedDays(assignments, second.id, date) >= 3 ? 1 : 0,
            repeatedPairCount(assignments, second.id, date),
            secondLoad.rank,
          ],
        );
      });
      insertAssignment(
        assignments,
        generatedAssignment(
          draft.id,
          date,
          "NIGHT",
          slot,
          eligible[0]?.id ?? null,
          "generated",
        ),
      );
    }
  }

  // 5. The wildcard may cover one exceptional sixth slot when the regular pool cannot.
  for (const assignment of assignments.filter((item) => !item.participantId)) {
    if (
      wildcardCount < settings.wildcard.max
      && wildcardWindow(assignment.date, assignment.kind)
      && !isAbsent(draft.absences, settings.wildcard.id, assignment.date, assignment.kind)
      && !alreadyInShift(assignments, settings.wildcard.id, assignment.date, assignment.kind)
      && !hasNextDayAssignment(assignments, settings.wildcard.id, assignment.date, assignment.kind)
      && assignments.filter(
        (item) =>
          item.participantId === settings.wildcard.id
          && weekendGroup(item.date) === weekendGroup(assignment.date),
      ).length < 2
    ) {
      assignment.participantId = settings.wildcard.id;
      assignment.source = "wildcard";
      wildcardCount += 1;
    }
  }

  assignments.sort((first, second) =>
    first.date.localeCompare(second.date)
    || first.kind.localeCompare(second.kind)
    || first.slot - second.slot,
  );
  const generated = { ...draft, assignments };
  const analysis = analyzeGeneratorSchedule({ draft: generated, settings, holidays });
  return {
    ...generated,
    generatedNotes: analysis.generatedNotes,
    warnings: analysis.warnings,
  };
}
