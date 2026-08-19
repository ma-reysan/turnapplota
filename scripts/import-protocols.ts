import "dotenv/config";
import { getDb } from "../src/db";
import { auditEvents, protocols } from "../src/db/schema";
import type { ProtocolCategory } from "../src/lib/types";

type ImportRow = {
  title: string;
  url: string;
  category: ProtocolCategory;
};

const DRIVE_IMPORTER = "Importación inicial desde Drive";
const drive = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// Fuente: carpeta personal de Protocolos indicada por el equipo. Las entradas
// pediátricas antiguas se conservan con su origen explícito para no confundirlas
// con las versiones 2026.
const rows: ImportRow[] = [
  { title: "Cirugía · Colecistectomía", url: drive("1GBLnog-nDcjQajgnm2SskViw8AbrQ1L9"), category: "surgery" },
  { title: "Cirugía · Hernioplastía", url: drive("1jYpCcPmXX8MeeWeUCckdIy7RssJwtzVt"), category: "surgery" },
  { title: "Neurología · Dolor neuropático", url: drive("1J5ahTiUGt0e66MY9LUqPfOgqkOecC6E9"), category: "neurology" },
  { title: "Neurología · Cefalea", url: drive("1iOd1XBY64rI3qj2NKM-s6kPd8V_RDznd"), category: "neurology" },
  { title: "Derivación APS · Ginecología", url: drive("16qsglMEsVqtECi2xthBe9xoNdFFeHJ24"), category: "aps_network" },
  { title: "Derivación APS · Cardiología", url: drive("1ZGYHp7rzV9VNuV5fkagsXfEeRbfEVCeB"), category: "aps_network" },
  { title: "Derivación APS · Medicina interna", url: drive("1AHOS1dMwnSGK-lSdnFNQ9iJt9jQWEDks"), category: "aps_network" },
  { title: "Derivación APS · Neurología", url: drive("1TIksDqojNCD2hSihvP_QCJ5Vax5sFdiB"), category: "aps_network" },
  { title: "APS · Protocolo HEARTS", url: drive("102BuumArLzhnf3e0wsj0Cbwn3UyPXV-d"), category: "aps_network" },
  { title: "Derivación APS · Urología", url: drive("1Uglix0TwPK15bJNEs06KHT3FbX4tsxrf"), category: "aps_network" },
  { title: "Derivación APS · Oftalmología", url: drive("1W0vgiAQREPdaTTw1vFNn0SCYfIplrqKS"), category: "aps_network" },
  { title: "Oftalmología · Sospecha de glaucoma de ángulo abierto", url: drive("1M5PTqR0lSE8VnFtfHZ6dEMtoJTcpjv1C"), category: "ophthalmology" },
  { title: "Oftalmología · Pterigión", url: drive("1Gj2e1sj0PHhZ-qiCtcKuugvUY4mLKZff"), category: "ophthalmology" },
  { title: "Oftalmología · Dermatochalasis", url: drive("1hQCqfUpdtkdF0WYDBLPU3K61SXo3zzCx"), category: "ophthalmology" },
  { title: "Oftalmología · Chalazión", url: drive("1OoanJY5z8Qde-t5VzVlEZcha7UvGJWrV"), category: "ophthalmology" },
  { title: "ORL · Epistaxis recurrente", url: drive("1kQuAQSTYxeOQc2I-k7ABCQWRrfA49TFL"), category: "ent" },
  { title: "ORL · Amigdalitis recurrente", url: drive("1rstFlpBR8tTxQf_rLdRO459OjCr82Ee7"), category: "ent" },
  { title: "ORL · Apnea", url: drive("1VjEIN1T4RdLBIo0RJahvYTA0CK1xo5hv"), category: "ent" },
  { title: "Pediatría 2026 · Recién nacido de madre SGB (+)", url: drive("1R0_jKIKZSvqNXx1Jt2I52nNn5ZMYcn-m"), category: "pediatrics" },
  { title: "Pediatría 2026 · Taquipnea transitoria y EMH", url: drive("1nVUmdSTB1Bc69gZpQdafZ3tKaWYzZlbQ"), category: "pediatrics" },
  { title: "Pediatría 2026 · Síndrome diarreico agudo", url: drive("115g-U6DYd-8bAQouSCAklPuxojhJZONn"), category: "pediatrics" },
  { title: "Pediatría 2026 · ITU", url: drive("10KeCKxsWzwCPI_RsKCme5mnvdDAXodxa"), category: "pediatrics" },
  { title: "Pediatría 2026 · Laringitis", url: drive("16VBF-q3Wu81rYCjqBHmAuISiPyqzqirf"), category: "pediatrics" },
  { title: "Pediatría 2026 · Bronquiolitis", url: drive("1FTwtoadEnDjV74eRaRfHDfvnuNc4yMzB"), category: "pediatrics" },
  { title: "Pediatría 2026 · Neumonía", url: drive("1OVLuUJEgGu6_c-LZQVd2WXAm5Y5dbIj5"), category: "pediatrics" },
  { title: "Pediatría 2026 · Fluidoterapia", url: drive("1eTOit82FqqYHr7vZDNi7fniPdFZSjtaF"), category: "pediatrics" },
  { title: "Pediatría 2026 · Hiperbilirrubinemia", url: drive("1tJHyU5Z_JZlNNSpo6OMjd7tgGIG6znv_"), category: "pediatrics" },
  { title: "Pediatría 2026 · RN de madre drogadicta", url: drive("1mtpRe2EpfkuFPfdf9Ut3VKVYfNJW5hum"), category: "pediatrics" },
  { title: "Pediatría 2026 · Síndrome disentérico", url: drive("1dauJr_X5ZWWDfqi7t0vAU1AX-kcOuSFi"), category: "pediatrics" },
  { title: "Pediatría 2026 · Infecciones de piel bacterianas", url: drive("13oHfmdF6pdu7kvHkH0cWBjEp_Tv52XQ6"), category: "pediatrics" },
  { title: "Pediatría 2026 · Fiebre sin foco", url: drive("1ocLaLt8x0mqlNrRKqxP1JE0LOjzCe6i_"), category: "pediatrics" },
  { title: "Pediatría 2026 · PEG", url: drive("1FELNYHSDSjzpJbfftE3rMNqlwJwNxitB"), category: "pediatrics" },
  { title: "Pediatría 2026 · Hipoglicemia neonatal", url: drive("12Q0eLPtNkFuto4PYgAtQz-9C8-5xkVzT"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · ITU febril", url: "https://docs.google.com/document/d/1zITPnjaAt_VY7gfzTBFck1rAeevpTYhL0zES23usIco/edit", category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Derivación total", url: drive("14HSimque5OKxyXaOPQba1M2zDL31x7pP"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Convulsión febril", url: drive("1JDtguKltMnT9D2EfKIs62bVRm0OzaqVq"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Síndrome disentérico", url: drive("1iCKlvg2N7M-JH86frnH6wHgDDVleZtyE"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Neumonía", url: drive("1EdWiM4Xu4ypryEDoHYcRCTGeSNxDdRhh"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Celulitis", url: drive("1-CsPH0c4HU-n26jtSpuNQCM5VNDCclQM"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Taquipnea transitoria y EMH", url: drive("1DVU4J6cMvabj9KtxBiDgvRVHGlzAly2B"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Alimentación RN", url: drive("1hRN5UjdJGmXH1FBsKj2RIo8MUzNRoPI2"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Hiperbilirrubinemia", url: drive("1ist-vi_-rPE-UcEjtoj-hYfknjvoGfMa"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · SGB", url: drive("1lgsGaw6B4bfVxyelxYynsSXXWzOB60B2"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Síndrome diarreico agudo", url: drive("1duG-mi7oBsH97WL1pXcvKTXyiV81kr0X"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · RN de madre drogadicta", url: drive("19f3ZBpxz8cRkOuG27X4K6OaVzUH2Y9ZK"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · PEG", url: drive("14_vnYR3cRrmR4cNv1aRhECF2gsw4ZaGq"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Laringitis", url: drive("1GPsp9Qr__UXnxldolEZh4FqmSIXPavzs"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · ITU febril (PDF)", url: drive("11tDVVm58oM91GgXAnq1KMrxP8CxWcHQa"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Impétigo", url: drive("12ACY_gnp1Ao5NTI4QzN-OYvwcPG0HbQG"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Hipoglicemia", url: drive("14SqG_vcqfhrYMjz_WY-SUv3BajIGfp87"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Erisipela", url: drive("1MjhquKZyDG6XxhxiDJOhnMhvjIyJCSDU"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Fiebre sin foco", url: drive("1FjxITbEBdd57UthAbTlDcotU8NwltYyb"), category: "pediatrics" },
  { title: "Pediatría (archivo anterior) · Bronquiolitis", url: drive("1E96ZVpNB8ScH6BsR3pR4CcgPBtMgL4J1"), category: "pediatrics" },
  { title: "APS · Mapas de derivación GES", url: drive("12wfUkC3YjT_efJ1iC93QqzbAgHtG9Fdw"), category: "aps_network" },
];

async function main() {
  const db = getDb();
  const existing = await db.select({ url: protocols.url }).from(protocols);
  const existingUrls = new Set(existing.map((item) => item.url));
  const missing = rows.filter((item) => !existingUrls.has(item.url));
  if (!missing.length) {
    console.log("No hay protocolos nuevos para importar.");
    return;
  }
  const inserted = await db.insert(protocols).values(missing.map((item) => ({ ...item, updatedBy: DRIVE_IMPORTER }))).returning();
  await db.insert(auditEvents).values(inserted.map((item) => ({
    action: "protocol.imported",
    entityType: "protocol",
    entityId: item.id,
    after: item,
    actor: DRIVE_IMPORTER,
  })));
  console.log(`Importados ${inserted.length} protocolos desde Drive.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
