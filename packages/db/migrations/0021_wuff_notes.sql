CREATE TABLE "wuff_note_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"note_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"uploader_id" text NOT NULL,
	"pathname" text NOT NULL,
	"digest" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"ready" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_note_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"body" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_note_links" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "wuff_note_links_source_id_target_id_pk" PRIMARY KEY("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "wuff_note_members" (
	"note_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wuff_note_members_note_id_user_id_pk" PRIMARY KEY("note_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "wuff_note_preferences" (
	"note_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "wuff_note_preferences_note_id_user_id_pk" PRIMARY KEY("note_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "wuff_note_tasks" (
	"note_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"creator_id" text NOT NULL,
	CONSTRAINT "wuff_note_tasks_note_id_task_id_pk" PRIMARY KEY("note_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "wuff_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mode" text DEFAULT 'note' NOT NULL,
	"theme" text DEFAULT 'blue' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_notes_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"settings" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wuff_note_assets" ADD CONSTRAINT "wuff_note_assets_note_id_wuff_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."wuff_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_note_assets" ADD CONSTRAINT "wuff_note_assets_uploader_id_wuff_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."wuff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_note_cards" ADD CONSTRAINT "wuff_note_cards_note_id_wuff_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."wuff_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_note_links" ADD CONSTRAINT "wuff_note_links_source_id_wuff_notes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."wuff_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_note_links" ADD CONSTRAINT "wuff_note_links_target_id_wuff_notes_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."wuff_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_note_members" ADD CONSTRAINT "wuff_note_members_note_id_wuff_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."wuff_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_note_members" ADD CONSTRAINT "wuff_note_members_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_note_preferences" ADD CONSTRAINT "wuff_note_preferences_note_id_wuff_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."wuff_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_note_preferences" ADD CONSTRAINT "wuff_note_preferences_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_note_tasks" ADD CONSTRAINT "wuff_note_tasks_note_id_wuff_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."wuff_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_note_tasks" ADD CONSTRAINT "wuff_note_tasks_task_id_wuff_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wuff_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_note_tasks" ADD CONSTRAINT "wuff_note_tasks_creator_id_wuff_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."wuff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_notes" ADD CONSTRAINT "wuff_notes_owner_id_wuff_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_notes_settings" ADD CONSTRAINT "wuff_notes_settings_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wuff_note_assets_operation_idx" ON "wuff_note_assets" USING btree ("uploader_id","operation_id");--> statement-breakpoint
CREATE INDEX "wuff_note_assets_note_idx" ON "wuff_note_assets" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "wuff_note_cards_note_idx" ON "wuff_note_cards" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "wuff_note_links_target_idx" ON "wuff_note_links" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "wuff_note_members_user_idx" ON "wuff_note_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wuff_notes_owner_updated_idx" ON "wuff_notes" USING btree ("owner_id","updated_at");