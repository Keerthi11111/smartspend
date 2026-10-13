/**
 * FILE: proxy.ts
 * ROUTE: runs before /dashboard/*, /login and /register (see `config.matcher` below)
 *
 * WHAT IT DOES: A route guard. Before one of the matched pages loads, it reads the
 * "token" login cookie and checks it. Logged-out users who try to open the dashboard
 * are sent to /login. Logged-in users who open /login or /register go to /dashboard.
 * WHERE IT FITS: Next.js runs it automatically on every matching request, before the
 * page renders. It uses verifyToken() from lib/auth.ts. The token is set by
 * POST /api/auth/login and cleared by POST /api/auth/logout.
 * WHY THIS CODE: In Next 16 `proxy.ts` is the new name for `middleware.ts`. It uses
 * `jose` (through lib/auth.ts) because jose also works where Node-only libraries don't.
 * It does NOT touch the database, so it stays fast. That makes it only an "optimistic"
 * check. Every API route still checks the user again with getAuthenticatedUser().
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

// Pages that only make sense for logged-OUT users.
const authPages = ["/login", "/register"];

// Optimistic check only: API routes still verify the user themselves.
export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Read the JWT from the "token" cookie and verify its signature/expiry.
    // A missing or invalid token gives `payload = null` → treated as logged out.
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const isAuthenticated = typeof payload?.userId === "number";

    // Logged-out user on a dashboard page → send to /login.
    // We remember the page they wanted in `?next=` so login can send them back there.
    if (pathname.startsWith("/dashboard") && !isAuthenticated) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", pathname);

        return NextResponse.redirect(loginUrl);
    }

    // Already logged in but opening /login or /register → skip straight to the dashboard.
    if (authPages.includes(pathname) && isAuthenticated) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Otherwise let the request continue to the page as normal.
    return NextResponse.next();
}

// Only run the proxy for these paths. Everything else (landing page, API routes,
// static files) skips it, so it doesn't slow down requests that don't need it.
export const config = {
    matcher: ["/dashboard/:path*", "/login", "/register"],
};
