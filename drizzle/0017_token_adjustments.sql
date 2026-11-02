CREATE TABLE IF NOT EXISTS "token_adjustments" (
  "id" text PRIMARY KEY NOT NULL,
  "doctor_id" text NOT NULL REFERENCES "doctors"("id"),
  "week_start" date NOT NULL,
  "delta" integer NOT NULL CHECK ("delta" IN (-1, 1)),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "token_adjustments_doctor_week_idx" ON "token_adjustments" ("doctor_id", "week_start");
