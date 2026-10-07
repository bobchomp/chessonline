CREATE TABLE "chat_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pin" varchar(6),
	"status" text DEFAULT 'waiting' NOT NULL,
	"created_by" text NOT NULL,
	"white_id" text,
	"white_name" text,
	"black_id" text,
	"black_name" text,
	"fen" text NOT NULL,
	"moves" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"initial_ms" integer,
	"increment_ms" integer DEFAULT 0 NOT NULL,
	"white_ms" integer,
	"black_ms" integer,
	"last_move_at" timestamp with time zone,
	"draw_offer_by" text,
	"rematch_offer_by" text,
	"rematch_game_id" uuid,
	"result" text,
	"termination" text,
	"white_seen_at" timestamp with time zone,
	"black_seen_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_game_idx" ON "chat_messages" USING btree ("game_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "games_waiting_pin_idx" ON "games" USING btree ("pin") WHERE "games"."status" = 'waiting';--> statement-breakpoint
CREATE INDEX "games_white_idx" ON "games" USING btree ("white_id","updated_at");--> statement-breakpoint
CREATE INDEX "games_black_idx" ON "games" USING btree ("black_id","updated_at");