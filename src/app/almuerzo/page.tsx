import { LunchMenuView } from "@/components/lunch-menu-view";
import { getLatestLunchMenu } from "@/lib/lunch-menu";

export default async function AlmuerzoPage() {
  return <LunchMenuView initialMenu={await getLatestLunchMenu()} />;
}
