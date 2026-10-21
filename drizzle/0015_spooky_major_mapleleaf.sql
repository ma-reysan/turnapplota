CREATE TABLE "schedule_shift_color_legend" (
	"schedule_id" text NOT NULL,
	"color_key" text NOT NULL,
	"label" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_shift_color_legend_schedule_id_color_key_pk" PRIMARY KEY("schedule_id","color_key")
);
--> statement-breakpoint
ALTER TABLE "on_call_weeks" ADD COLUMN "color_keys" jsonb DEFAULT '[null,null,null]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_shift_color_legend" ADD CONSTRAINT "schedule_shift_color_legend_schedule_id_schedule_months_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedule_months"("id") ON DELETE cascade ON UPDATE no action;