CREATE TABLE "puzzle_solves" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"puzzle_id" text NOT NULL,
	"status" text NOT NULL,
	"mistakes" integer DEFAULT 0 NOT NULL,
	"hints" integer DEFAULT 0 NOT NULL,
	"on_time" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "puzzle_solves_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE INDEX "puzzle_solves_day_idx" ON "puzzle_solves" USING btree ("day");