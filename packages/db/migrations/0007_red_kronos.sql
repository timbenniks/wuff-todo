ALTER TABLE "wuff_lists" ADD COLUMN "mode" text DEFAULT 'simple' NOT NULL;--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD COLUMN "number" integer NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "wuff_tasks_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD COLUMN "status" text DEFAULT 'todo' NOT NULL;--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD COLUMN "priority" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD COLUMN "assignee_id" text;--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD COLUMN "references" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "wuff_tasks" SET "status" = CASE WHEN "completed" THEN 'done' ELSE 'todo' END;--> statement-breakpoint
-- Old checkbox clients stay compatible during rolling deployment. Historical
-- completion dates are unknown; only subsequent transitions get an actual time.
CREATE FUNCTION wuff_task_completion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'todo' AND NEW.completed THEN NEW.status := 'done'; END IF;
    NEW.completed := NEW.status = 'done';
    IF NEW.completed THEN NEW.completed_at := COALESCE(NEW.completed_at, now()); END IF;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.completed := NEW.status = 'done';
    ELSIF NEW.completed IS DISTINCT FROM OLD.completed THEN
      NEW.status := CASE WHEN NEW.completed THEN 'done' ELSE 'todo' END;
    END IF;
    IF NEW.completed IS DISTINCT FROM OLD.completed THEN
      NEW.completed_at := CASE WHEN NEW.completed THEN now() ELSE NULL END;
      NEW.updated_at := now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;--> statement-breakpoint
CREATE TRIGGER wuff_task_completion BEFORE INSERT OR UPDATE OF status, completed ON wuff_tasks FOR EACH ROW EXECUTE FUNCTION wuff_task_completion();--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD CONSTRAINT "wuff_tasks_assignee_id_wuff_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."wuff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wuff_tasks_number_idx" ON "wuff_tasks" USING btree ("number");--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD CONSTRAINT "wuff_tasks_status" CHECK ("wuff_tasks"."status" in ('todo', 'in_progress', 'in_review', 'blocked', 'done'));--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD CONSTRAINT "wuff_tasks_completion_status" CHECK ("wuff_tasks"."completed" = ("wuff_tasks"."status" = 'done'));--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD CONSTRAINT "wuff_tasks_priority" CHECK ("wuff_tasks"."priority" in ('none', 'low', 'medium', 'high', 'urgent'));
