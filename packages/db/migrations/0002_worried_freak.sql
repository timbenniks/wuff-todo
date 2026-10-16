CREATE TABLE "wuff_list_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"list_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wuff_lists" ADD COLUMN "color" text DEFAULT 'blue' NOT NULL;--> statement-breakpoint
ALTER TABLE "wuff_lists" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "wuff_lists" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "wuff_list_preferences" ADD CONSTRAINT "wuff_list_preferences_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_sections" ADD CONSTRAINT "wuff_sections_list_id_wuff_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."wuff_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wuff_sections_list_idx" ON "wuff_sections" USING btree ("list_id");--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD CONSTRAINT "wuff_tasks_section_id_wuff_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."wuff_sections"("id") ON DELETE set null ON UPDATE no action;