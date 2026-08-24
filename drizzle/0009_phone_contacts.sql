DO $$ BEGIN
  CREATE TYPE "public"."phone_establishment" AS ENUM('lota', 'coronel', 'regional');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "phone_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "establishment" "phone_establishment" NOT NULL,
  "service" text NOT NULL,
  "phones" jsonb NOT NULL,
  "source_needs_review" boolean DEFAULT false NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "phone_contact_establishment_service_unique" ON "phone_contacts" USING btree ("establishment", "service");
