CREATE TABLE IF NOT EXISTS "pearl_versions" (
  "version" text PRIMARY KEY NOT NULL,
  "lines" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
