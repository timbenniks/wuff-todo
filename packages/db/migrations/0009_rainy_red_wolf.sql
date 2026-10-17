CREATE TABLE "wuff_github_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"github_id" text NOT NULL,
	"login" text NOT NULL,
	"credentials" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_github_auth_states" (
	"hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"verifier" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_github_bindings" (
	"list_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"repository_id" text NOT NULL,
	"repository" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_github_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_github_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wuff_github_links" (
	"task_id" uuid PRIMARY KEY NOT NULL,
	"list_id" uuid NOT NULL,
	"repository_id" text NOT NULL,
	"issue_number" integer,
	"node_id" text,
	"baseline" jsonb,
	"conflict" jsonb,
	"state" text DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"error" text,
	"operation_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wuff_github_accounts" ADD CONSTRAINT "wuff_github_accounts_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_github_auth_states" ADD CONSTRAINT "wuff_github_auth_states_user_id_wuff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wuff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_github_bindings" ADD CONSTRAINT "wuff_github_bindings_list_id_wuff_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."wuff_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_github_bindings" ADD CONSTRAINT "wuff_github_bindings_owner_id_wuff_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."wuff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_github_jobs" ADD CONSTRAINT "wuff_github_jobs_task_id_wuff_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wuff_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_github_links" ADD CONSTRAINT "wuff_github_links_task_id_wuff_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wuff_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wuff_github_links" ADD CONSTRAINT "wuff_github_links_list_id_wuff_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."wuff_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wuff_github_issue_unique" ON "wuff_github_links" USING btree ("repository_id","issue_number");--> statement-breakpoint
CREATE FUNCTION wuff_enqueue_github_task() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.title,NEW.content,NEW.completed) IS DISTINCT FROM (OLD.title,OLD.content,OLD.completed)
     AND EXISTS(SELECT 1 FROM wuff_github_links WHERE task_id=NEW.id) THEN
    INSERT INTO wuff_github_jobs(id,task_id) VALUES ('task:'||NEW.id,NEW.id)
      ON CONFLICT(id) DO UPDATE SET generation=wuff_github_jobs.generation+1,available_at=now(),attempts=0;
    UPDATE wuff_github_links SET state='pending',revision=revision+1 WHERE task_id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER wuff_github_task_change AFTER UPDATE OF title,content,completed ON wuff_tasks
FOR EACH ROW EXECUTE FUNCTION wuff_enqueue_github_task();
