/**
 * FILE: lib/api.ts
 * ROUTE: n/a (helper)
 *
 * WHAT IT DOES: Small server-side helpers shared by the API routes. They send JSON
 * errors, turn raw request values into safe ids/amounts/dates/colors, and run
 * "does this category/account belong to this user?" lookups.
 * WHERE IT FITS: Imported by the route handlers in app/api/** and by lib/validation.ts.
 * It uses prisma (lib/prisma.ts) for the Category and Account ownership checks.
 * WHY THIS CODE: Request bodies and URL params are untrusted. They may be strings,
 * negative numbers or garbage. Each parser returns a clean value or null, so routes can
 * do `if (!x) return jsonError(...)` without repeating the same checks everywhere.
 * The ownership helpers always filter by userId, so one user can't use another's records.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Standard error response used by all routes: { error: "message" } with an HTTP status.
// The browser's apiFetch (lib/client.ts) reads this `error` field to show the message.
export function jsonError(error: string, status: number) {
    return NextResponse.json({ error }, { status });
}

// Turn a URL param / body value into a positive whole-number id, or null if invalid.
// Example: "12" → 12, "abc" → null, "-3" → null, "1.5" → null.
export function parseId(value: string | number | null | undefined) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Money amounts must be real numbers greater than zero (NaN/Infinity/0/negative → null).
export function parseAmount(value: unknown) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
}

// Accept only non-empty strings that JavaScript can parse as a real date.
export function parseDate(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }

    const date = new Date(value);
    // new Date("garbage") gives "Invalid Date", whose getTime() is NaN.
    return Number.isNaN(date.getTime()) ? null : date;
}

// For optional text fields: trim spaces, and store null instead of an empty string.
export function trimmedOrNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Matches a 6-digit hex color like "#22d3ee" (case-insensitive).
const hexColor = /^#[0-9a-f]{6}$/i;

// Use the given color only if it is a valid hex code; otherwise fall back to a default.
// This stops arbitrary strings from being saved and later used in style attributes.
export function parseColor(value: unknown, fallback = "#22d3ee") {
    return typeof value === "string" && hexColor.test(value) ? value : fallback;
}

// Default categories (userId null) plus the user's own
// Returned as a Prisma `where` fragment so it can be spread into any category query.
export function visibleCategories(userId: number) {
    return { OR: [{ userId: null }, { userId }] };
}

// Find a category by id, but only if this user is allowed to see it.
// Returns null for someone else's category, so routes can reply 404/400.
export function findUserCategory(userId: number, id: number) {
    return prisma.category.findFirst({
        where: { id, ...visibleCategories(userId) },
    });
}

// Find an account by id only if it belongs to this user (accounts are never shared).
export function findUserAccount(userId: number, id: number) {
    return prisma.account.findFirst({ where: { id, userId } });
}

// Optional accountId from a request body: undefined = invalid, null = none
// Three outcomes let the caller tell "no account chosen" (null, OK)
// apart from "bad or someone else's account" (undefined → return an error).
export async function resolveAccountId(userId: number, value: unknown) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const id = parseId(value as string);
    const account = id ? await findUserAccount(userId, id) : null;

    return account ? account.id : undefined;
}
