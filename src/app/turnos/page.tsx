import { PageHeader } from "@/components/page-header";
import { ScheduleCalendar } from "@/components/schedule-calendar";
import { getAppData } from "@/lib/data";

export default async function TurnosPage() {
  const data = await getAppData();
  const published = data.schedules.filter((schedule) => schedule.status === "published");

  return (
    <>
      <PageHeader
        eyebrow="Calendario clínico"
        title="Turnos - Servicio de Urgencia - Lota"
      />
      <ScheduleCalendar doctors={data.doctors} schedules={published} />
    </>
  );
}
