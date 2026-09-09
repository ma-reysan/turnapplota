import { AlertTriangle } from "lucide-react";
import type { Doctor } from "@/lib/types";
import type { NightToDayConflict } from "@/lib/schedule-conflicts";

function displayDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" })
    .format(new Date(`${date}T12:00:00`));
}

export function ScheduleConflictNotice({
  conflicts,
  doctors,
  visibleDates,
}: {
  conflicts: NightToDayConflict[];
  doctors: Doctor[];
  visibleDates?: Set<string>;
}) {
  const relevant = visibleDates
    ? conflicts.filter((conflict) => visibleDates.has(conflict.nightDate) || visibleDates.has(conflict.dayDate))
    : conflicts;
  if (!relevant.length) return null;

  const doctorsById = new Map(doctors.map((doctor) => [doctor.id, doctor]));
  return (
    <section className="mb-2 rounded-xl border border-amber-500/55 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100" role="alert">
      <div className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-300" />
        Turno incompatible: noche seguida de día
      </div>
      <ul className="mt-1 space-y-0.5 pl-5 text-[11px] marker:text-amber-600">
        {relevant.map((conflict) => {
          const doctor = doctorsById.get(conflict.doctorId);
          return <li key={`${conflict.doctorId}-${conflict.nightDate}`}><strong>{doctor?.shortName ?? "Médico"}</strong>: noche {displayDate(conflict.nightDate)} → día {displayDate(conflict.dayDate)}.</li>;
        })}
      </ul>
    </section>
  );
}
