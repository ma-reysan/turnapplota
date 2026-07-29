CREATE TYPE "public"."replacement_mode" AS ENUM('voluntary', 'invoked', 'legacy_unknown');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."shift_kind" AS ENUM('DAY', 'NIGHT');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"actor" text DEFAULT 'jefatura' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_hash" text NOT NULL,
	"successful" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" text PRIMARY KEY NOT NULL,
	"short_name" text NOT NULL,
	"long_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replacement_types" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"default_points" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replacements" (
	"id" text PRIMARY KEY NOT NULL,
	"replacement_date" date NOT NULL,
	"doctor_id" text NOT NULL,
	"type_code" text NOT NULL,
	"points" integer NOT NULL,
	"mode" "replacement_mode" NOT NULL,
	"note" text,
	"expires_at" date NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_months" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" "schedule_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"schedule_id" text NOT NULL,
	"shift_date" date NOT NULL,
	"kind" "shift_kind" NOT NULL,
	"slot" integer NOT NULL,
	"doctor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_schedule_id_schedule_months_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedule_months"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "doctors_short_name_unique" ON "doctors" USING btree ("short_name");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_year_month_unique" ON "schedule_months" USING btree ("year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_slot_unique" ON "shift_assignments" USING btree ("schedule_id","shift_date","kind","slot");