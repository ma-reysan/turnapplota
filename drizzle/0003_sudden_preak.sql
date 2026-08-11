CREATE TABLE "shift_color_legend" (
	"color_key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_markers" (
	"id" text PRIMARY KEY NOT NULL,
	"schedule_id" text NOT NULL,
	"shift_date" date NOT NULL,
	"kind" "shift_kind" NOT NULL,
	"slot" integer NOT NULL,
	"color_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shift_markers" ADD CONSTRAINT "shift_markers_schedule_id_schedule_months_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedule_months"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shift_marker_slot_unique" ON "shift_markers" USING btree ("schedule_id","shift_date","kind","slot");