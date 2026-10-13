/**
 * FILE: prisma.config.ts
 * ROUTE: n/a (config)
 *
 * WHAT IT DOES: Tells the Prisma CLI where the schema is, where migrations are kept,
 * and which database to connect to.
 * WHERE IT FITS: Read by `npx prisma migrate dev`, `npx prisma generate`, `prisma studio`
 * and similar commands. The running app does not use it. At runtime, lib/prisma.ts
 * connects with its own adapter.
 * WHY THIS CODE: In Prisma 7 the database URL lives here instead of in schema.prisma.
 * The CLI does not load .env by itself, so `import "dotenv/config"` loads it first,
 * so that DATABASE_URL is set.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
// Loads variables from .env into process.env (must come before reading DATABASE_URL).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // The data model (tables, enums, relations).
  schema: "prisma/schema.prisma",

  // Where `prisma migrate` writes and reads the SQL migration history.
  migrations: {
    path: "prisma/migrations",
  },

  // PostgreSQL connection used by the CLI commands.
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});