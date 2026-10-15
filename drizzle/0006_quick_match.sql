CREATE TABLE "seeks" (
	"user_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"time_control_id" text NOT NULL,
	"rating" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"matched_game_id" uuid
);
--> statement-breakpoint
CREATE INDEX "seeks_time_control_idx" ON "seeks" USING btree ("time_control_id");