CREATE TABLE "wuff_reminder_deliveries" (
	"job_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"device_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wuff_reminder_deliveries_job_id_version_device_id_pk" PRIMARY KEY("job_id","version","device_id")
);
--> statement-breakpoint
CREATE TABLE "wuff_reminder_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"transport" text NOT NULL,
	"address" text NOT NULL,
	"subscription" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_reminder_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"task_id" uuid,
	"kind" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"scheduling" text DEFAULT 'pending' NOT NULL,
	"message_id" text
);
--> statement-breakpoint
CREATE TABLE "wuff_reminder_lists" (
	"user_id" text NOT NULL,
	"list_id" uuid NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"daily_included" boolean DEFAULT true NOT NULL,
	CONSTRAINT "wuff_reminder_lists_user_id_list_id_pk" PRIMARY KEY("user_id","list_id")
);
--> statement-breakpoint
CREATE TABLE "wuff_reminder_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"preferences" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wuff_reminder_deliveries" ADD CONSTRAINT "wuff_reminder_deliveries_job_id_wuff_reminder_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."wuff_reminder_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_reminder_deliveries" ADD CONSTRAINT "wuff_reminder_deliveries_device_id_wuff_reminder_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."wuff_reminder_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_reminder_devices" ADD CONSTRAINT "wuff_reminder_devices_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_reminder_jobs" ADD CONSTRAINT "wuff_reminder_jobs_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_reminder_jobs" ADD CONSTRAINT "wuff_reminder_jobs_task_id_wuff_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wuff_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_reminder_lists" ADD CONSTRAINT "wuff_reminder_lists_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_reminder_lists" ADD CONSTRAINT "wuff_reminder_lists_list_id_wuff_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."wuff_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_reminder_preferences" ADD CONSTRAINT "wuff_reminder_preferences_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wuff_reminder_address" ON "wuff_reminder_devices" USING btree ("transport","address");--> statement-breakpoint
CREATE INDEX "wuff_reminder_device_user" ON "wuff_reminder_devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wuff_reminder_task_user" ON "wuff_reminder_jobs" USING btree ("user_id","task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wuff_reminder_digest_user" ON "wuff_reminder_jobs" USING btree ("user_id") WHERE "wuff_reminder_jobs"."kind" = 'digest';--> statement-breakpoint
CREATE INDEX "wuff_reminder_pending" ON "wuff_reminder_jobs" USING btree ("scheduling");