/**
 * FILE: lib/get-auth-user.ts
 * ROUTE: n/a (helper)
 *
 * WHAT IT DOES: Finds out who is making the current request. It reads the "token"
 * cookie, verifies it, and loads that user from the database. It returns
 * { id, name, email }, or null if the user is not logged in.
 * WHERE IT FITS: Called at the start of almost every API route (app/api/.../route.ts).
 * Routes return 401 when it gives null, and use `user.id` to filter every query.
 * It calls verifyToken() (lib/auth.ts) and prisma.user.findUnique (lib/prisma.ts).
 * WHY THIS CODE: proxy.ts only does a quick check for pages. API routes can be
 * called directly (e.g. with curl), so each one must check the user itself. We also
 * look the user up in the DB so a token for a deleted account doesn't work.
 * Only safe fields are selected, so the password hash never leaves this function.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function getAuthenticatedUser() {
    // In Next 16, cookies() is async, so it must be awaited.
    const cookiesStore = await cookies();

    // The login route stores the JWT in a cookie called "token".
    const token = cookiesStore.get("token")?.value;

    if (!token) {
        return null;
    }

    // Reject fake/expired tokens, and tokens that don't carry a numeric userId.
    const payload = await verifyToken(token);

    if (!payload || typeof payload.userId !== "number") {
        return null;
    }

    // Make sure the user still exists. `select` keeps the password hash out of the result.
    const user = await prisma.user.findUnique({
        where: {
            id: payload.userId,
        },
        select: {
            id: true,
            name: true,
            email: true
        }
    });

    return user;
}