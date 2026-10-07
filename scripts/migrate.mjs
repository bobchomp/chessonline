// Applies any pending SQL migrations in ./drizzle to DATABASE_URL.
// Runs before `next build`, so every Vercel deploy brings the schema up to date.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL not set; skipping database migrations.");
  process.exit(0);
}

await migrate(drizzle({ client: neon(url) }), { migrationsFolder: "drizzle" });
console.log("[migrate] Database is up to date.");
