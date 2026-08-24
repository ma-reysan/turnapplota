import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { phoneContacts } from "@/db/schema";
import { defaultPhoneContacts } from "@/lib/phone-directory";

async function main() {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL no está configurada");
  const db = getDb();
  for (const contact of defaultPhoneContacts) {
    await db
      .insert(phoneContacts)
      .values({
        establishment: contact.establishment,
        service: contact.service,
        phones: contact.phones,
        sourceNeedsReview: contact.sourceNeedsReview,
      })
      .onConflictDoUpdate({
        target: [phoneContacts.establishment, phoneContacts.service],
        set: {
          phones: sql`excluded.phones`,
          sourceNeedsReview: sql`excluded.source_needs_review`,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`Directorio importado: ${defaultPhoneContacts.length} contactos`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
