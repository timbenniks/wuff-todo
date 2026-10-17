CREATE TABLE "wuff_list_views" (
	"user_id" text NOT NULL,
	"list_id" uuid NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"view" jsonb NOT NULL,
	CONSTRAINT "wuff_list_views_user_id_list_id_pk" PRIMARY KEY("user_id","list_id")
);
--> statement-breakpoint
ALTER TABLE "wuff_list_views" ADD CONSTRAINT "wuff_list_views_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_list_views" ADD CONSTRAINT "wuff_list_views_list_id_wuff_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."wuff_lists"("id") ON DELETE cascade ON UPDATE no action;