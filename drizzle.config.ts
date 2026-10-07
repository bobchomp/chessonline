import { defineConfig } from "drizzle-kit";

// Pick up DATABASE_URL from .env.local when running migrations locally.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local; rely on the environment.
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
