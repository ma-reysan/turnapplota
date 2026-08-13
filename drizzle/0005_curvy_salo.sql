ALTER TABLE "protocols" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
UPDATE "protocols" SET "category" = CASE
  WHEN "title" LIKE 'Cirugía ·%' THEN 'surgery'
  WHEN "title" LIKE 'Neurología ·%' THEN 'neurology'
  WHEN "title" LIKE 'Pediatría%' THEN 'pediatrics'
  WHEN "title" LIKE 'Oftalmología ·%' THEN 'ophthalmology'
  WHEN "title" LIKE 'ORL ·%' THEN 'ent'
  WHEN "category" = 'administrative' THEN 'clinical'
  ELSE "category"
END;--> statement-breakpoint
DROP TYPE "public"."protocol_category";--> statement-breakpoint
CREATE TYPE "public"."protocol_category" AS ENUM('clinical', 'surgery', 'neurology', 'pediatrics', 'ophthalmology', 'ent', 'aps_network');--> statement-breakpoint
ALTER TABLE "protocols" ALTER COLUMN "category" SET DATA TYPE "public"."protocol_category" USING "category"::"public"."protocol_category";
