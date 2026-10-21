import { PageHeader } from "@/components/page-header";
import { ReplacementsView } from "@/components/replacements-view";
import { getAppData } from "@/lib/data";
import { readNovemberData } from "@/lib/november-data";

export default async function ReemplazosPage() {
  const data = await getAppData();
  const november = await readNovemberData(data);
  return (
    <>
      <PageHeader
        description="Consulta quién ha cubierto reemplazos y cómo se distribuyen los puntos durante los últimos 120 días."
        eyebrow="Equidad del equipo"
        title="Tabla de Reemplazos"
      />
      <ReplacementsView
        doctors={data.doctors}
        lastInvokedDoctorId={data.lastInvokedDoctorId}
        pearls={data.pearls}
        replacements={data.replacements}
        types={data.replacementTypes}
        schedules={data.schedules.filter((item) => item.id >= "2026-11")}
        november={{
          absences: november.absences.map(({ doctorId, startDate, endDate }) => ({ doctorId, startDate, endDate })),
          freezes: november.freezes,
          corrections: november.corrections.map(({ assignmentId, worked }) => ({ assignmentId, worked })),
        }}
        initialNow={new Date().toISOString()}
      />
    </>
  );
}
