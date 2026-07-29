import { PageHeader } from "@/components/page-header";
import { ReplacementsView } from "@/components/replacements-view";
import { getAppData } from "@/lib/data";

export default async function ReemplazosPage() {
  const data = await getAppData();
  return (
    <>
      <PageHeader
        description="Consulta quién ha cubierto reemplazos y cómo se distribuyen los puntos durante los últimos 120 días."
        eyebrow="Equidad del equipo"
        title="Tabla de reemplazos"
      />
      <ReplacementsView
        doctors={data.doctors}
        lastInvokedDoctorId={data.lastInvokedDoctorId}
        pearls={data.pearls}
        replacements={data.replacements}
        types={data.replacementTypes}
      />
    </>
  );
}
