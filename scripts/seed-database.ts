import "dotenv/config";
import seedJson from "../src/data/seed.json";
import { getDb } from "../src/db";
import {
  doctors,
  replacementTypes,
  replacements,
  scheduleMonths,
  shiftAssignments,
  shiftColorLegend,
  shiftMarkers,
} from "../src/db/schema";
import { DEFAULT_SHIFT_COLOR_LEGEND } from "../src/lib/shift-colors";
import type { SeedData } from "../src/lib/types";

const seed = seedJson as SeedData;

async function inChunks<T>(values: T[], callback: (chunk: T[]) => Promise<unknown>) {
  for (let index = 0; index < values.length; index += 400) {
    await callback(values.slice(index, index + 400));
  }
}

async function main() {
  const db = getDb();
  await db
    .insert(doctors)
    .values(seed.doctors)
    .onConflictDoNothing({ target: doctors.id });

  await db
    .insert(replacementTypes)
    .values(
      seed.replacementTypes.map((type, index) => ({
        ...type,
        sortOrder: index,
      })),
    )
    .onConflictDoNothing({ target: replacementTypes.code });

  await db
    .insert(scheduleMonths)
    .values(
      seed.schedules.map((schedule) => ({
        id: schedule.id,
        year: schedule.year,
        month: schedule.month,
        status: schedule.status,
        version: 1,
      })),
    )
    .onConflictDoNothing({ target: scheduleMonths.id });

  const assignments = seed.schedules.flatMap((schedule) =>
    schedule.assignments.map((assignment) => ({
      ...assignment,
      scheduleId: schedule.id,
      shiftDate: assignment.date,
    })),
  );
  await inChunks(assignments, (chunk) =>
    db
      .insert(shiftAssignments)
      .values(chunk)
      .onConflictDoNothing({ target: shiftAssignments.id }),
  );

  const markers = seed.schedules.flatMap((schedule) =>
    (schedule.markers ?? []).map((marker) => ({
      ...marker,
      scheduleId: schedule.id,
      shiftDate: marker.date,
    })),
  );
  if (markers.length) {
    await inChunks(markers, (chunk) =>
      db.insert(shiftMarkers).values(chunk).onConflictDoNothing({ target: shiftMarkers.id }),
    );
  }

  await db
    .insert(shiftColorLegend)
    .values((seed.shiftColorLegend ?? DEFAULT_SHIFT_COLOR_LEGEND).map((item) => ({
      colorKey: item.key,
      label: item.label,
    })))
    .onConflictDoNothing({ target: shiftColorLegend.colorKey });

  await inChunks(
    seed.replacements.map((replacement) => ({
      ...replacement,
      replacementDate: replacement.date,
      superhero: replacement.superhero ?? replacement.typeCode === "HERO",
    })),
    (chunk) =>
      db
        .insert(replacements)
        .values(chunk)
        .onConflictDoNothing({ target: replacements.id }),
  );

  console.log(
    `Seed aplicado: ${seed.doctors.length} médicos, ${seed.migration.assignments} turnos y ${seed.replacements.length} reemplazos.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
