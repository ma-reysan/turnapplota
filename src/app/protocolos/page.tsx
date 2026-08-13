import { ProtocolsView } from "@/components/protocols-view";
import { getAppData } from "@/lib/data";

export default async function ProtocolosPage() {
  const data = await getAppData();
  return <ProtocolsView initialProtocols={data.protocols} />;
}
