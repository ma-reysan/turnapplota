import { AnalysisDashboard } from "@/components/analysis-dashboard";
import { getAppData } from "@/lib/data";

export default async function AnalisisPage() {
  const data = await getAppData();
  return <AnalysisDashboard doctors={data.doctors} holidays={data.holidays} schedules={data.schedules} />;
}
