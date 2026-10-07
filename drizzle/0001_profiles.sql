CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"username" varchar(20) NOT NULL,
	"username_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_lower_idx" ON "profiles" USING btree (lower("username"));