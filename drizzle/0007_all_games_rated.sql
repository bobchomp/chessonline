ALTER TABLE "games" ALTER COLUMN "rated" SET DEFAULT true;--> statement-breakpoint
-- Every game counts towards ratings now, including ones already under way.
UPDATE "games" SET "rated" = true WHERE "rated" = false AND "status" IN ('waiting', 'active');
