CREATE TABLE "shift_generator_months" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"start_lane" integer DEFAULT 0 NOT NULL,
	"absences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"balances" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assignments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_notes" text DEFAULT '' NOT NULL,
	"manual_notes" text DEFAULT '' NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_generator_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"lanes" jsonb NOT NULL,
	"wildcard" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
