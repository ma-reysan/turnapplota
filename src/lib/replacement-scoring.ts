import type { ReplacementType } from "@/lib/types";

export type ReplacementShift = "day" | "night" | "both";

const TYPE_BY_WEEKDAY: Record<number, Record<"day" | "night", string>> = {
  0: { day: "SUN_DAY", night: "SUN_NIGHT" },
  1: { day: "DAY_MON", night: "NIGHT_MON_THU" },
  2: { day: "DAY_TUE_THU", night: "NIGHT_MON_THU" },
  3: { day: "DAY_TUE_THU", night: "NIGHT_MON_THU" },
  4: { day: "DAY_TUE_THU", night: "NIGHT_MON_THU" },
  5: { day: "DAY_FRI", night: "NIGHT_FRI" },
  6: { day: "SAT_12", night: "SAT_12" },
};

export function getAutomaticReplacementType({
  date,
  shift,
  types,
  holidays,
}: {
  date: string;
  shift: ReplacementShift;
  types: ReplacementType[];
  holidays: Set<string>;
}) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  if (shift === "both") {
    if (weekday === 6 || holidays.has(date)) {
      return types.find((type) => type.code === "SAT_HOLIDAY_24");
    }

    const dayType = types.find((type) => type.code === TYPE_BY_WEEKDAY[weekday].day);
    const nightType = types.find((type) => type.code === TYPE_BY_WEEKDAY[weekday].night);
    if (!dayType || !nightType) return undefined;

    return {
      code: "FULL_24",
      label: "Turno 24 h",
      defaultPoints: dayType.defaultPoints + nightType.defaultPoints,
    };
  }

  return types.find((type) => type.code === TYPE_BY_WEEKDAY[weekday][shift]);
}
