import { PageHeader } from "@/components/page-header";
import { ScheduleCalendar } from "@/components/schedule-calendar";
import { getAppData } from "@/lib/data";

export default async function TurnosPage() {
  const data = await getAppData();
  const published = data.schedules.filter((schedule) => schedule.status === "published");

  return (
    <>
      <PageHeader
        description="Consulta los tres médicos de día y los dos médicos de noche de cada jornada."
        eyebrow="Calendario clínico"
        title="Turnos médicos"
      />
      <ScheduleCalendar doctors={data.doctors} schedules={published} />
    </>
  );
}
