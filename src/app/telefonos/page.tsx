import { PhoneDirectoryView } from "@/components/phone-directory-view";
import { getPhoneContacts } from "@/lib/data";

export default async function TelefonosPage() {
  return <PhoneDirectoryView initialContacts={await getPhoneContacts()} />;
}
