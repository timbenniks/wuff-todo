CREATE TABLE "wuff_agent_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"credentials" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_agent_bindings" (
	"list_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"environment_id" uuid NOT NULL,
	"environment_name" text NOT NULL,
	"repository" text NOT NULL,
	"required_secrets" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_agent_conversations" (
	"task_id" uuid PRIMARY KEY NOT NULL,
	"list_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"environment_id" uuid NOT NULL,
	"environment_name" text NOT NULL,
	"repository" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wuff_agent_conversations_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "wuff_agent_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"provider_run_id" text,
	"initial" boolean NOT NULL,
	"mode" text NOT NULL,
	"prompt" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"result" text,
	"error" text,
	"last_event_id" text,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_github_pr_snapshots" (
	"task_id" uuid PRIMARY KEY NOT NULL,
	"repository_id" text NOT NULL,
	"issue_number" integer NOT NULL,
	"pull_requests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stale" boolean DEFAULT true NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wuff_agent_accounts" ADD CONSTRAINT "wuff_agent_accounts_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_agent_bindings" ADD CONSTRAINT "wuff_agent_bindings_list_id_wuff_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."wuff_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_agent_bindings" ADD CONSTRAINT "wuff_agent_bindings_owner_id_wuff_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."wuff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_agent_conversations" ADD CONSTRAINT "wuff_agent_conversations_task_id_wuff_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wuff_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_agent_conversations" ADD CONSTRAINT "wuff_agent_conversations_list_id_wuff_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."wuff_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_agent_conversations" ADD CONSTRAINT "wuff_agent_conversations_owner_id_wuff_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."wuff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_agent_runs" ADD CONSTRAINT "wuff_agent_runs_task_id_wuff_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wuff_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_agent_runs" ADD CONSTRAINT "wuff_agent_runs_actor_id_wuff_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."wuff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_github_pr_snapshots" ADD CONSTRAINT "wuff_github_pr_snapshots_task_id_wuff_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wuff_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wuff_agent_operation" ON "wuff_agent_runs" USING btree ("actor_id","operation_id");