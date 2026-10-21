import { PageHeader } from "@/components/page-header";
import { ScheduleCalendar } from "@/components/schedule-calendar";
import { getAppData } from "@/lib/data";
import { readNovemberData } from "@/lib/november-data";

export default async function TurnosPage() {
  const data = await getAppData();
  const published = data.schedules.filter((schedule) => schedule.status === "published");
  const november = await readNovemberData({ ...data, schedules: published });

  return (
    <>
      <PageHeader
        eyebrow="Calendario clínico"
        title="Turnos - Servicio de Urgencia - Lota"
      />
      <ScheduleCalendar
        doctors={data.doctors}
        schedules={published}
        shiftColorLegend={data.shiftColorLegend}
        onCallWeeks={november.onCallWeeks}
      />
    </>
  );
}
