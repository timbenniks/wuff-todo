ALTER TABLE "wuff_tasks" ADD COLUMN "parent_task_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "wuff_tasks_id_list_idx" ON "wuff_tasks" USING btree ("id","list_id");--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD CONSTRAINT "wuff_tasks_parent_fk" FOREIGN KEY ("parent_task_id","list_id") REFERENCES "public"."wuff_tasks"("id","list_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wuff_tasks_parent_idx" ON "wuff_tasks" USING btree ("parent_task_id");--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD CONSTRAINT "wuff_tasks_not_self_parent" CHECK ("wuff_tasks"."parent_task_id" is null or "wuff_tasks"."parent_task_id" <> "wuff_tasks"."id");--> statement-breakpoint
ALTER TABLE "wuff_tasks" ADD CONSTRAINT "wuff_tasks_child_no_section" CHECK ("wuff_tasks"."parent_task_id" is null or "wuff_tasks"."section_id" is null);