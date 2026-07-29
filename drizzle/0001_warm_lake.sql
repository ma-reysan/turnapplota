ALTER TABLE "replacements" ADD COLUMN "superhero" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "replacements" SET "superhero" = true WHERE "type_code" = 'HERO';
--> statement-breakpoint
UPDATE "replacement_types" SET "active" = false WHERE "code" = 'HERO';
