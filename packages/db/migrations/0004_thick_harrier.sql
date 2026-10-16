CREATE TABLE "wuff_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid,
	"task_id" uuid,
	"uploader_id" text NOT NULL,
	"digest" text NOT NULL,
	"pathname" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"ready" boolean DEFAULT false NOT NULL,
	"attached" boolean DEFAULT false NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wuff_attachments_pathname_unique" UNIQUE("pathname")
);
--> statement-breakpoint
ALTER TABLE "wuff_attachments" ADD CONSTRAINT "wuff_attachments_list_id_wuff_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."wuff_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_attachments" ADD CONSTRAINT "wuff_attachments_task_id_wuff_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wuff_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_attachments" ADD CONSTRAINT "wuff_attachments_uploader_id_wuff_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."wuff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wuff_attachments_task_idx" ON "wuff_attachments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "wuff_attachments_cleanup_idx" ON "wuff_attachments" USING btree ("created_at");