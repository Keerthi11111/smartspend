/**
 * FILE: lib/redirect.ts
 * ROUTE: n/a (helper)
 *
 * WHAT IT DOES: Sends the browser to the /login page.
 * WHERE IT FITS: Used by browser code (e.g. apiFetch in lib/client.ts when an API
 * returns 401, and some dashboard pages such as Budgets and Transactions).
 * Browser-only, because it uses `window`.
 * WHY THIS CODE: It uses a full page load (window.location) instead of Next's
 * router.push(). A full load sends a fresh request, so proxy.ts runs again and sees
 * the current cookie, and no old logged-in page state stays in memory.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
// Full page navigation so the proxy re-checks the session cookie
export function redirectToLogin() {
    window.location.assign("/login");
}
