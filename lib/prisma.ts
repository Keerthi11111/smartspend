/**
 * FILE: lib/prisma.ts
 * ROUTE: n/a (helper)
 *
 * WHAT IT DOES: Creates the one shared Prisma database client (`prisma`) that the
 * whole server side uses to read and write PostgreSQL.
 * WHERE IT FITS: Imported by every API route (app/api/**), and by lib/get-auth-user.ts,
 * lib/api.ts and lib/recurring.ts. The tables it talks to are defined in
 * prisma/schema.prisma. The client class itself is generated into generated/prisma/.
 * WHY THIS CODE: Prisma 7 connects through a "driver adapter" (@prisma/adapter-pg),
 * so we build the adapter from DATABASE_URL. In development, Next.js hot-reload
 * re-runs this file many times. Saving the client on `globalThis` stops it from
 * opening a new database connection pool on every reload.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// The PostgreSQL connection string comes from the .env file.
const connectionString = process.env.DATABASE_URL;

// Fail early with a clear message instead of a confusing error on the first query.
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

// The pg (node-postgres) adapter is how Prisma 7 actually talks to PostgreSQL.
const adapter = new PrismaPg({
  connectionString,
});

// `globalThis` survives hot-reloads in development, so we keep the client there.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reuse the existing client if there is one, otherwise create a new one.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

// Only cache globally in development. In production the module loads once anyway.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}