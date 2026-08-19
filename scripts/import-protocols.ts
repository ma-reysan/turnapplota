import "dotenv/config";
import { getDb } from "../src/db";
import { auditEvents, protocols } from "../src/db/schema";
import { DRIVE_PROTOCOL_CATALOG } from "../src/lib/drive-protocol-catalog";

const DRIVE_IMPORTER = "Importación inicial desde Drive";
const drive = (id: string) => `https://drive.google.com/file/d/${id}/view`;
const legacyRows = [
  { title: "Cirugía · Colecistectomía", url: drive("1GBLnog-nDcjQajgnm2SskViw8AbrQ1L9"), category: "clinical" },
  { title: "Cirugía · Hernioplastía", url: drive("1jYpCcPmXX8MeeWeUCckdIy7RssJwtzVt"), category: "clinical" },
  { title: "Neurología · Dolor neuropático", url: drive("1J5ahTiUGt0e66MY9LUqPfOgqkOecC6E9"), category: "clinical" },
  { title: "Neurología · Cefalea", url: drive("1iOd1XBY64rI3qj2NKM-s6kPd8V_RDznd"), category: "clinical" },
  { title: "Derivación APS · Ginecología", url: drive("16qsglMEsVqtECi2xthBe9xoNdFFeHJ24"), category: "aps_network" },
  { title: "Derivación APS · Cardiología", url: drive("1ZGYHp7rzV9VNuV5fkagsXfEeRbfEVCeB"), category: "aps_network" },
  { title: "Derivación APS · Medicina interna", url: drive("1AHOS1dMwnSGK-lSdnFNQ9iJt9jQWEDks"), category: "aps_network" },
  { title: "Derivación APS · Neurología", url: drive("1TIksDqojNCD2hSihvP_QCJ5Vax5sFdiB"), category: "aps_network" },
  { title: "APS · Protocolo HEARTS", url: drive("102BuumArLzhnf3e0wsj0Cbwn3UyPXV-d"), category: "aps_network" },
  { title: "Derivación APS · Urología", url: drive("1Uglix0TwPK15bJNEs06KHT3FbX4tsxrf"), category: "aps_network" },
  { title: "Derivación APS · Oftalmología", url: drive("1W0vgiAQREPdaTTw1vFNn0SCYfIplrqKS"), category: "aps_network" },
  { title: "Oftalmología · Sospecha de glaucoma de ángulo abierto", url: drive("1M5PTqR0lSE8VnFtfHZ6dEMtoJTcpjv1C"), category: "clinical" },
  { title: "Oftalmología · Pterigión", url: drive("1Gj2e1sj0PHhZ-qiCtcKuugvUY4mLKZff"), category: "clinical" },
  { title: "Oftalmología · Dermatochalasis", url: drive("1hQCqfUpdtkdF0WYDBLPU3K61SXo3zzCx"), category: "clinical" },
  { title: "Oftalmología · Chalazión", url: drive("1OoanJY5z8Qde-t5VzVlEZcha7UvGJWrV"), category: "clinical" },
  { title: "ORL · Epistaxis recurrente", url: drive("1kQuAQSTYxeOQc2I-k7ABCQWRrfA49TFL"), category: "clinical" },
  { title: "ORL · Amigdalitis recurrente", url: drive("1rstFlpBR8tTxQf_rLdRO459OjCr82Ee7"), category: "clinical" },
  { title: "ORL · Apnea", url: drive("1VjEIN1T4RdLBIo0RJahvYTA0CK1xo5hv"), category: "clinical" },
  { title: "Pediatría 2026 · Recién nacido de madre SGB (+)", url: drive("1R0_jKIKZSvqNXx1Jt2I52nNn5ZMYcn-m"), category: "clinical" },
  { title: "Pediatría 2026 · Taquipnea transitoria y EMH", url: drive("1nVUmdSTB1Bc69gZpQdafZ3tKaWYzZlbQ"), category: "clinical" },
  { title: "Pediatría 2026 · Síndrome diarreico agudo", url: drive("115g-U6DYd-8bAQouSCAklPuxojhJZONn"), category: "clinical" },
  { title: "Pediatría 2026 · ITU", url: drive("10KeCKxsWzwCPI_RsKCme5mnvdDAXodxa"), category: "clinical" },
  { title: "Pediatría 2026 · Laringitis", url: drive("16VBF-q3Wu81rYCjqBHmAuISiPyqzqirf"), category: "clinical" },
  { title: "Pediatría 2026 · Bronquiolitis", url: drive("1FTwtoadEnDjV74eRaRfHDfvnuNc4yMzB"), category: "clinical" },
  { title: "Pediatría 2026 · Neumonía", url: drive("1OVLuUJEgGu6_c-LZQVd2WXAm5Y5dbIj5"), category: "clinical" },
  { title: "Pediatría 2026 · Fluidoterapia", url: drive("1eTOit82FqqYHr7vZDNi7fniPdFZSjtaF"), category: "clinical" },
  { title: "Pediatría 2026 · Hiperbilirrubinemia", url: drive("1tJHyU5Z_JZlNNSpo6OMjd7tgGIG6znv_"), category: "clinical" },
  { title: "Pediatría 2026 · RN de madre drogadicta", url: drive("1mtpRe2EpfkuFPfdf9Ut3VKVYfNJW5hum"), category: "clinical" },
  { title: "Pediatría 2026 · Síndrome disentérico", url: drive("1dauJr_X5ZWWDfqi7t0vAU1AX-kcOuSFi"), category: "clinical" },
  { title: "Pediatría 2026 · Infecciones de piel bacterianas", url: drive("13oHfmdF6pdu7kvHkH0cWBjEp_Tv52XQ6"), category: "clinical" },
  { title: "Pediatría 2026 · Fiebre sin foco", url: drive("1ocLaLt8x0mqlNrRKqxP1JE0LOjzCe6i_"), category: "clinical" },
  { title: "Pediatría 2026 · PEG", url: drive("1FELNYHSDSjzpJbfftE3rMNqlwJwNxitB"), category: "clinical" },
  { title: "Pediatría 2026 · Hipoglicemia neonatal", url: drive("12Q0eLPtNkFuto4PYgAtQz-9C8-5xkVzT"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · ITU febril", url: "https://docs.google.com/document/d/1zITPnjaAt_VY7gfzTBFck1rAeevpTYhL0zES23usIco/edit", category: "clinical" },
  { title: "Pediatría (archivo anterior) · Derivación total", url: drive("14HSimque5OKxyXaOPQba1M2zDL31x7pP"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Convulsión febril", url: drive("1JDtguKltMnT9D2EfKIs62bVRm0OzaqVq"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Síndrome disentérico", url: drive("1iCKlvg2N7M-JH86frnH6wHgDDVleZtyE"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Neumonía", url: drive("1EdWiM4Xu4ypryEDoHYcRCTGeSNxDdRhh"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Celulitis", url: drive("1-CsPH0c4HU-n26jtSpuNQCM5VNDCclQM"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Taquipnea transitoria y EMH", url: drive("1DVU4J6cMvabj9KtxBiDgvRVHGlzAly2B"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Alimentación RN", url: drive("1hRN5UjdJGmXH1FBsKj2RIo8MUzNRoPI2"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Hiperbilirrubinemia", url: drive("1ist-vi_-rPE-UcEjtoj-hYfknjvoGfMa"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · SGB", url: drive("1lgsGaw6B4bfVxyelxYynsSXXWzOB60B2"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Síndrome diarreico agudo", url: drive("1duG-mi7oBsH97WL1pXcvKTXyiV81kr0X"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · RN de madre drogadicta", url: drive("19f3ZBpxz8cRkOuG27X4K6OaVzUH2Y9ZK"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · PEG", url: drive("14_vnYR3cRrmR4cNv1aRhECF2gsw4ZaGq"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Laringitis", url: drive("1GPsp9Qr__UXnxldolEZh4FqmSIXPavzs"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · ITU febril (PDF)", url: drive("11tDVVm58oM91GgXAnq1KMrxP8CxWcHQa"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Impétigo", url: drive("12ACY_gnp1Ao5NTI4QzN-OYvwcPG0HbQG"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Hipoglicemia", url: drive("14SqG_vcqfhrYMjz_WY-SUv3BajIGfp87"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Erisipela", url: drive("1MjhquKZyDG6XxhxiDJOhnMhvjIyJCSDU"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Fiebre sin foco", url: drive("1FjxITbEBdd57UthAbTlDcotU8NwltYyb"), category: "clinical" },
  { title: "Pediatría (archivo anterior) · Bronquiolitis", url: drive("1E96ZVpNB8ScH6BsR3pR4CcgPBtMgL4J1"), category: "clinical" },
  { title: "APS · Mapas de derivación GES", url: drive("12wfUkC3YjT_efJ1iC93QqzbAgHtG9Fdw"), category: "aps_network" },
] as const;

// El catálogo se obtiene desde la carpeta de Drive compartida por el equipo.
// Se conservan los enlaces históricos que no pertenecen a esa carpeta.
const rows = [
  ...DRIVE_PROTOCOL_CATALOG,
  ...legacyRows.filter((legacy) => !DRIVE_PROTOCOL_CATALOG.some((item) => protocolKey(item.url) === protocolKey(legacy.url))),
];

// Drive puede devolver el mismo archivo con parámetros distintos (por ejemplo,
// /view y /view?usp=drivesdk). Para importar sin duplicar, se compara el ID.
function protocolKey(url: string) {
  const driveId = url.match(/\/d\/([^/?]+)/)?.[1] ?? url.match(/[?&]id=([^&]+)/)?.[1];
  return driveId ? `drive:${driveId}` : url;
}

async function main() {
  const db = getDb();
  const existing = await db.select({ url: protocols.url }).from(protocols);
  const existingKeys = new Set(existing.map((item) => protocolKey(item.url)));
  const missing = rows.filter((item) => !existingKeys.has(protocolKey(item.url)));
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
