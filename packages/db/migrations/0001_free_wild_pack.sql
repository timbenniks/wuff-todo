ALTER TABLE "wuff_invitations" ADD COLUMN "recipient_id" text;--> statement-breakpoint
ALTER TABLE "wuff_invitations" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wuff_invitations" ADD CONSTRAINT "wuff_invitations_recipient_id_wuff_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."wuff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wuff_invitations_recipient_idx" ON "wuff_invitations" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "wuff_invitations_list_idx" ON "wuff_invitations" USING btree ("list_id");