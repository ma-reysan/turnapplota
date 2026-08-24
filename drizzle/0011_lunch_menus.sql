CREATE TABLE "lunch_menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_date" date NOT NULL,
	"content" text NOT NULL,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "lunch_menu_date_unique" ON "lunch_menus" USING btree ("menu_date");