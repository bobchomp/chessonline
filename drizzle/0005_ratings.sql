ALTER TABLE "games" ADD COLUMN "rated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "white_rating" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "black_rating" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "white_rating_diff" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "black_rating_diff" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "rating" double precision DEFAULT 1500 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "rating_rd" double precision DEFAULT 350 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "rating_vol" double precision DEFAULT 0.06 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "rated_games" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "peak_rating" double precision;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "rated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "profiles_rating_idx" ON "profiles" USING btree ("rating");