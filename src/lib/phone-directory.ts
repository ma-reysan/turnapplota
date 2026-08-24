import phoneDirectory from "@/data/phone-directory.json";
import type { PhoneContact, PhoneEstablishment } from "@/lib/types";

export type PhoneDirectoryGroup = {
  id: PhoneEstablishment;
  title: string;
  sourceEstablishment: "Hospital de Lota" | "Hospital Regional" | "Hospital San José de Coronel";
};

export const phoneDirectoryGroups: PhoneDirectoryGroup[] = [
  { id: "lota", title: "Hospital de Lota", sourceEstablishment: "Hospital de Lota" },
  { id: "coronel", title: "Hospital de Coronel", sourceEstablishment: "Hospital San José de Coronel" },
  { id: "regional", title: "Hospital Regional", sourceEstablishment: "Hospital Regional" },
];

const acronyms = new Set(["APS", "ETS", "HGGB", "IAAS", "PCR", "RRHH", "SAMU", "SAR", "SOME", "UCI", "UTI"]);

export function normalizePhoneService(value: string) {
  return value.replace(/\b[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\b/g, (word) => {
    const upper = word.toLocaleUpperCase("es-CL");
    return acronyms.has(upper) ? upper : word;
  }).replace(/\s+/g, " ").trim();
}

const establishmentFromSource: Record<PhoneDirectoryGroup["sourceEstablishment"], PhoneEstablishment> = {
  "Hospital de Lota": "lota",
  "Hospital San José de Coronel": "coronel",
  "Hospital Regional": "regional",
};

export const defaultPhoneContacts: PhoneContact[] = phoneDirectory.map((entry, index) => ({
  id: `source-${index}`,
  establishment: establishmentFromSource[entry.establishment as PhoneDirectoryGroup["sourceEstablishment"]],
  service: normalizePhoneService(entry.service),
  phones: entry.phones,
  sourceNeedsReview: entry.needsReview,
  updatedAt: "2026-08-20T00:00:00.000Z",
}));

export function getDefaultPhoneContacts(establishment: PhoneEstablishment) {
  return defaultPhoneContacts.filter((entry) => entry.establishment === establishment);
}
