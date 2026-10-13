/**
 * FILE: app/api/settings/profile/route.ts
 * ROUTE: API: PUT /api/settings/profile
 *
 * WHAT IT DOES: PUT updates the logged-in user's name and email address and
 * returns the updated user (id, name, email).
 * WHERE IT FITS: Called by app/dashboard/settings/page.tsx (Profile form).
 * Uses getAuthenticatedUser, jsonError (lib/api.ts) and the User model.
 * WHY THIS CODE: The user id always comes from the login cookie, so a user can
 * only change their own profile. Name must not be empty and email must look
 * like an email (400 otherwise). Emails are unique, so if the email changes we
 * check (ignoring upper/lower case) that no other user already has it and
 * return 409 Conflict if they do. The response uses "select" so the password
 * hash is never sent back.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { jsonError } from "@/lib/api";

// PUT /api/settings/profile → change name and email
export async function PUT(request: Request) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        const body = await request.json();

        // Read and trim both fields; anything that isn't a string becomes ""
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email =
            typeof body.email === "string" ? body.email.trim() : "";

        // Validation
        if (!name) {
            return jsonError("Name is required", 400);
        }

        // Simple "something@something.something" format check
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return jsonError("Enter a valid email address", 400);
        }

        // Only if the email actually changed: make sure no OTHER user already
        // uses it ("insensitive" = case doesn't matter)
        if (email.toLowerCase() !== user.email.toLowerCase()) {
            const taken = await prisma.user.findFirst({
                where: { email: { equals: email, mode: "insensitive" }, id: { not: user.id } },
            });

            if (taken) {
                return jsonError("That email is already in use", 409);
            }
        }

        // Save and return only safe fields (never the password hash)
        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { name, email },
            select: { id: true, name: true, email: true },
        });

        return NextResponse.json({ user: updated });
    } catch (error) {
        console.error("PUT profile error:", error);
        return jsonError("Failed to update profile", 500);
    }
}
