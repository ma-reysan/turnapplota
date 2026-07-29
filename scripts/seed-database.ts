import "dotenv/config";
import seedJson from "../src/data/seed.json";
import { getDb } from "../src/db";
import {
  doctors,
  replacementTypes,
  replacements,
  scheduleMonths,
  shiftAssignments,
} from "../src/db/schema";
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
