/**
 * FILE: app/api/auth/me/route.ts
 * ROUTE: API: GET /api/auth/me
 *
 * WHAT IT DOES: GET returns the currently logged-in user ({ user: { id, name,
 * email } }) based on the "token" cookie, or 401 if nobody is logged in.
 * WHERE IT FITS: Called by app/components/Header.tsx (to show the user's name)
 * and app/dashboard/settings/page.tsx (to pre-fill the profile form). Uses
 * cookies() from next/headers, verifyToken() from lib/auth.ts and the User
 * model via lib/prisma.ts.
 * WHY THIS CODE: The token cookie is httpOnly, so the browser's JavaScript
 * can't read it to learn who is logged in — it has to ask the server. This
 * does the same steps as lib/get-auth-user.ts, written out by hand, and
 * returns 401 for every failure so the client has one simple "not logged in"
 * case to handle.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";

// GET /api/auth/me — "who am I?" Returns the logged-in user's id, name and email.
export async function GET() {
    try {
        // Read the "token" cookie. In Next 16, cookies() returns a Promise, so we await it.
        const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;

        // No cookie at all = not logged in. 401 = "Unauthorized".
        if (!token) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Check the token's signature and expiry. If someone edited or forged the
        // token, or it is too old, verifyToken returns nothing useful.
        const payload = await verifyToken(token);

        if (!payload || !payload.userId) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
        }

        // Load the user from the database. `select` picks only safe fields,
        // so the password hash is never even read.
        const user = await prisma.user.findUnique({
            where: { id: Number(payload.userId) },
            select: { id: true, name: true, email: true }
        })

        // The token is valid but the user no longer exists (e.g. deleted) — treat as logged out.
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 401 });
        }

        return NextResponse.json({ user });
    } catch (error) {
        // Any unexpected error is reported as 401 so the client simply treats the user as logged out.
        console.error("Auth verification error", error);

        return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }
}