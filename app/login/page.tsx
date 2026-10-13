/**
 * FILE: app/login/page.tsx
 * ROUTE: /login
 *
 * WHAT IT DOES: The login form. The user enters email and password. On success the
 * server sets the "token" cookie and the page goes to the dashboard (or back to the
 * page the user was trying to open).
 * WHERE IT FITS: Reached from the landing page ("Get Started"), from /register after
 * signing up, or when proxy.ts redirects a logged-out user here (with ?next=...).
 * It calls POST /api/auth/login (app/api/auth/login/route.ts), which checks the
 * password with bcrypt and creates the JWT with createToken() (lib/auth.ts).
 * WHY THIS CODE: "use client" is needed because the page uses state (useState) and
 * form events. The page never touches the token itself. The server stores it in an
 * httpOnly cookie that JavaScript can't read, which protects it from XSS. Logged-in
 * users never see this page because proxy.ts redirects them to /dashboard.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    // Router for moving to another page after a successful login (no full reload).
    const router = useRouter();
    // Form state: "controlled" inputs, so React always holds the current values.
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    // UI state: error message to show, and whether a request is in progress.
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Runs when the form is submitted (button click or Enter key).
    async function handleSubmit(e: FormEvent) {
        // Stop the browser's default full-page form submit; we send JSON with fetch instead.
        e.preventDefault();
        setLoading(true);
        setError("");

        try {

            // Send the credentials to the login API. If they are correct, the response
            // sets the "token" cookie, and the browser then sends it with every request.
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password
                })
            })

            const data = await response.json();

            // e.g. 401 "Invalid email or password" — show the API's message.
            if (!response.ok) {
                setError(data.error || "Login failed");
                return;
            }

            // Return to the page the proxy redirected from, if it's a local path
            // (must start with "/" but not "//", so ?next=//evil.com can't send users
            // to another website — an "open redirect" attack).
            const next = new URLSearchParams(window.location.search).get("next");
            router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
        } catch {
            // Network failure or the response wasn't JSON.
            setError("Unexpected error occured");
        } finally {
            // Always re-enable the button, whether it succeeded or failed.
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
            {/* Centered card holding the heading and the form */}
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">
                        Welcome back
                    </h1>

                    <p className="mt-2 text-slate-400">
                        Login to your expense dashboard.
                    </p>
                </div>

                {/* `required` and type="email" give quick browser-side checks; the API still validates */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="mb-2 block text-sm font-medium">
                            Email
                        </label>

                        <input type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" required />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">
                            Password
                        </label>

                        <input type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="******"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" required />
                    </div>

                    {/* Disabled while loading so the user can't submit twice */}
                    <button type="submit" disabled={loading}
                        className="w-full rounded-lg bg-cyan-500 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
                        {loading ? "Logging in..." : "Login"}
                    </button>

                    {/* Only rendered when there is an error message */}
                    {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

                    {/* Link to the sign-up page for new users */}
                    <p className="mt-6 text-center text-sm text-slate-400">Don&apos;t have an account?{" "}
                        <Link href="/register" className="text-cyan-400 hover:underline">
                            Register
                        </Link>
                    </p>
                </form>
            </div>
        </main>
    )
}