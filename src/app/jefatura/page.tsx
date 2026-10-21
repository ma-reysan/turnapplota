import { LockScreen } from "@/components/lock-screen";
import { ManagerHub } from "@/components/manager-hub";
import { hasJefaturaSession } from "@/lib/auth";
import { getAppData } from "@/lib/data";
import { readNovemberData } from "@/lib/november-data";

export default async function JefaturaPage() {
  const unlocked = await hasJefaturaSession();
  if (!unlocked) return <LockScreen />;
  const data = await getAppData();
  const november = await readNovemberData(data);
  return (
    <ManagerHub
      doctors={data.doctors}
      replacements={data.replacements}
      schedules={data.schedules}
      types={data.replacementTypes}
      holidays={data.holidays}
      shiftColorLegend={data.shiftColorLegend}
      shiftColorLegends={data.shiftColorLegends}
      november={november}
    />
  );
}
