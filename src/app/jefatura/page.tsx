import { LockScreen } from "@/components/lock-screen";
import { ManagerHub } from "@/components/manager-hub";
import { hasJefaturaSession } from "@/lib/auth";
import { getAppData } from "@/lib/data";

export default async function JefaturaPage() {
  const unlocked = await hasJefaturaSession();
  if (!unlocked) return <LockScreen />;
  const data = await getAppData();
  return (
    <ManagerHub
      doctors={data.doctors}
      replacements={data.replacements}
      schedules={data.schedules}
      types={data.replacementTypes}
      holidays={data.holidays}
      shiftColorLegend={data.shiftColorLegend}
    />
  );
}
