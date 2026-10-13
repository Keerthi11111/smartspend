/**
 * FILE: app/api/auth/logout/route.ts
 * ROUTE: API: POST /api/auth/logout
 *
 * WHAT IT DOES: POST logs the user out by overwriting the "token" cookie with
 * an empty value that has already expired, so the browser deletes it.
 * WHERE IT FITS: Called by the logout button in app/components/Sidebar.tsx,
 * which then sends the user to /login. No database or lib
 * helpers are needed — the login state lives only in the cookie.
 * WHY THIS CODE: The token cookie is httpOnly, so page JavaScript cannot
 * delete it itself; only the server can clear it. It uses POST (not GET) so a
 * simple link or image on another site can't log the user out by accident.
 * No auth check is needed: logging out when already logged out is harmless.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import {NextResponse} from "next/server";

// POST /api/auth/logout — clear the login cookie.
export async function POST() {
    const response = NextResponse.json({
        message:"Logged out successfully",
    })
    // Replace the cookie with an empty value and an expiry date in the past
    // (new Date(0) = 1 Jan 1970). The browser removes expired cookies.
    // path must match the path used at login ("/") or the browser treats it as a different cookie.
    response.cookies.set("token", "",{
        httpOnly:true,
        expires: new Date(0),
        path:"/",
    });

    return response;
}