ALTER TABLE "profiles" ALTER COLUMN "rating" SET DEFAULT 250;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "rating_rd" SET DEFAULT 200;--> statement-breakpoint
-- Fresh start for the new 250 scale: every player back to a new player's rating,
-- with no rated games, peak or rating history. Games themselves are kept.
UPDATE "profiles" SET "rating" = 250, "rating_rd" = 200, "rating_vol" = 0.06, "rated_games" = 0, "peak_rating" = NULL, "rated_at" = NULL;--> statement-breakpoint
UPDATE "games" SET "white_rating" = NULL, "black_rating" = NULL, "white_rating_diff" = NULL, "black_rating_diff" = NULL WHERE "white_rating" IS NOT NULL OR "black_rating" IS NOT NULL;--> statement-breakpoint
-- Anyone searching for a quick match was queued at their old rating.
DELETE FROM "seeks";
