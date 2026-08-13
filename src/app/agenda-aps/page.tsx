import { AgendaApsView } from "@/components/agenda-aps-view";
import { getAppData } from "@/lib/data";

export default async function AgendaApsPage() {
  const data = await getAppData();
  return <AgendaApsView initialAgenda={data.apsAgenda} />;
}
