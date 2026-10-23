CREATE TABLE "wuff_dashboard_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"settings" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wuff_dashboard_preferences" ADD CONSTRAINT "wuff_dashboard_preferences_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;