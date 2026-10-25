CREATE TABLE "wuff_notification_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"todo" boolean DEFAULT false NOT NULL,
	"totake" boolean DEFAULT false NOT NULL,
	"show_content" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_totake_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_totake_audit" (
	"ordinal" integer NOT NULL,
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"body" jsonb NOT NULL,
	CONSTRAINT "wuff_totake_audit_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "wuff_totake_deliveries" (
	"job_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"device_id" uuid NOT NULL,
	"group_id" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wuff_totake_deliveries_job_id_version_device_id_group_id_pk" PRIMARY KEY("job_id","version","device_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "wuff_totake_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"run_at" timestamp with time zone NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"scheduling" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "wuff_totake_jobs_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "wuff_totake_occurrences" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"day" integer NOT NULL,
	"body" jsonb NOT NULL,
	CONSTRAINT "wuff_totake_occurrences_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "wuff_totake_records" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"group_id" text NOT NULL,
	"kind" text NOT NULL,
	"undone" boolean DEFAULT false NOT NULL,
	"body" jsonb NOT NULL,
	CONSTRAINT "wuff_totake_records_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "wuff_totake_schedules" (
	"user_id" text NOT NULL,
	"treatment_id" text NOT NULL,
	"revision" integer NOT NULL,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wuff_totake_schedules_user_id_treatment_id_revision_pk" PRIMARY KEY("user_id","treatment_id","revision")
);
--> statement-breakpoint
CREATE TABLE "wuff_totake_stock_movements" (
	"ordinal" integer NOT NULL,
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"body" jsonb NOT NULL,
	CONSTRAINT "wuff_totake_stock_movements_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "wuff_totake_treatments" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"body" jsonb NOT NULL,
	CONSTRAINT "wuff_totake_treatments_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "wuff_notification_preferences" ADD CONSTRAINT "wuff_notification_preferences_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_totake_accounts" ADD CONSTRAINT "wuff_totake_accounts_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_totake_audit" ADD CONSTRAINT "wuff_totake_audit_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_totake_deliveries" ADD CONSTRAINT "wuff_totake_deliveries_job_id_wuff_totake_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."wuff_totake_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_totake_jobs" ADD CONSTRAINT "wuff_totake_jobs_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_totake_occurrences" ADD CONSTRAINT "wuff_totake_occurrences_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_totake_records" ADD CONSTRAINT "wuff_totake_records_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_totake_schedules" ADD CONSTRAINT "wuff_totake_schedules_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_totake_stock_movements" ADD CONSTRAINT "wuff_totake_stock_movements_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_totake_treatments" ADD CONSTRAINT "wuff_totake_treatments_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wuff_totake_occurrence_day" ON "wuff_totake_occurrences" USING btree ("user_id","day");