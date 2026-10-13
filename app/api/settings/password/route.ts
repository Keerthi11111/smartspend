/**
 * FILE: app/api/settings/password/route.ts
 * ROUTE: API: PUT /api/settings/password
 *
 * WHAT IT DOES: PUT changes the logged-in user's password after checking that
 * the current password they typed is correct.
 * WHERE IT FITS: Called by app/dashboard/settings/page.tsx (Change password
 * form). Uses getAuthenticatedUser, jsonError (lib/api.ts), bcryptjs and the
 * User model.
 * WHY THIS CODE: Asking for the current password stops someone who finds an
 * unlocked, logged-in browser from silently taking over the account.
 * Passwords are never stored as plain text: bcrypt.compare checks the typed
 * password against the stored hash, and bcrypt.hash (10 salt rounds) creates
 * the new hash. The new password must be at least 6 characters (400 otherwise).
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { jsonError } from "@/lib/api";

// PUT /api/settings/password → change password
export async function PUT(request: Request) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        const { currentPassword, newPassword } = await request.json();

        // Validation: both fields must be sent as text
        if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
            return jsonError("Current and new password are required", 400);
        }

        if (newPassword.length < 6) {
            return jsonError("Password must contain at least 6 characters", 400);
        }

        // getAuthenticatedUser doesn't return the password hash, so load it here
        const account = await prisma.user.findUnique({
            where: { id: user.id },
            select: { password: true },
        });

        // Compare what the user typed with the stored hash
        if (!account || !(await bcrypt.compare(currentPassword, account.password))) {
            return jsonError("Current password is incorrect", 400);
        }

        // Hash the new password (10 = salt rounds) and save the hash
        await prisma.user.update({
            where: { id: user.id },
            data: { password: await bcrypt.hash(newPassword, 10) },
        });

        return NextResponse.json({ message: "Password updated" });
    } catch (error) {
        console.error("PUT password error:", error);
        return jsonError("Failed to update password", 500);
    }
}
