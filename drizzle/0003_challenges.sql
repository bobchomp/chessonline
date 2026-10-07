ALTER TABLE "games" ADD COLUMN "invited_user_id" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "invited_name" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "abort_reason" text;--> statement-breakpoint
CREATE INDEX "games_invited_waiting_idx" ON "games" USING btree ("invited_user_id") WHERE "games"."status" = 'waiting';