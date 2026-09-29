import { EdfModule } from "@/components/edf-module";
import { getAppData } from "@/lib/data";

export default async function EdfPage() {
  const data = await getAppData();
  return (
    <EdfModule
      doctors={data.doctors}
      schedules={data.schedules.filter((schedule) => schedule.status === "published")}
      initialAgenda={data.apsAgenda}
    />
  );
}
