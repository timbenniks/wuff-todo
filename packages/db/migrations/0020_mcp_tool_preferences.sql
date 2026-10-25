CREATE TABLE "wuff_mcp_tool_preferences" (
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"enabled_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "wuff_mcp_tool_preferences_user_id_client_id_pk" PRIMARY KEY("user_id","client_id")
);
--> statement-breakpoint
ALTER TABLE "wuff_mcp_tool_preferences" ADD CONSTRAINT "wuff_mcp_tool_preferences_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_mcp_tool_preferences" ADD CONSTRAINT "wuff_mcp_tool_preferences_client_id_wuff_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."wuff_oauth_clients"("id") ON DELETE cascade ON UPDATE no action;