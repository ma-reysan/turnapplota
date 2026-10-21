CREATE TABLE "base_corrections" (
	"assignment_id" text PRIMARY KEY NOT NULL,
	"worked" boolean NOT NULL,
	"reason" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_absences" (
	"id" text PRIMARY KEY NOT NULL,
	"doctor_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "on_call_weeks" (
	"week_start" date PRIMARY KEY NOT NULL,
	"doctor_ids" jsonb NOT NULL,
	"manual" boolean DEFAULT false NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_freezes" (
	"id" text PRIMARY KEY NOT NULL,
	"doctor_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "only_volunteer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "allow_day" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "allow_night" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "allow_friday_saturday_24" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "doctors" SET "only_volunteer" = true, "allow_night" = false, "allow_friday_saturday_24" = true WHERE "id" = 'segura';--> statement-breakpoint
ALTER TABLE "base_corrections" ADD CONSTRAINT "base_corrections_assignment_id_shift_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."shift_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_absences" ADD CONSTRAINT "doctor_absences_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_freezes" ADD CONSTRAINT "point_freezes_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;