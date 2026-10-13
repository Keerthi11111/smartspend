/**
 * FILE: app/register/page.tsx
 * ROUTE: /register
 *
 * WHAT IT DOES: The sign-up form (name, email, password). It creates a new user
 * account and then sends the user to /login to sign in.
 * WHERE IT FITS: Reached from the "Register" link on /login. It calls
 * POST /api/auth/register (app/api/auth/register/route.ts), which hashes the password
 * with bcrypt and creates a User row through Prisma. Next step: app/login/page.tsx.
 * WHY THIS CODE: "use client" is needed for useState and the form submit handler.
 * Registering does not log the user in automatically, so the login flow (and the
 * cookie it sets) stays in one place. proxy.ts sends already logged-in users to /dashboard.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    // Router used to go to /login after a successful sign-up.
    const router = useRouter();
    // Form field values (controlled inputs).
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    // Error text to show, and a flag to disable the button while the request runs.
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Called when the form is submitted.
    async function handleRegister(e: FormEvent) {
        // Prevent the default page reload; we send JSON with fetch instead.
        e.preventDefault();

        setError("");

        setLoading(true);

        try {
            // Create the account. The API checks the fields, rejects duplicate emails
            // (409) and passwords shorter than 6 characters (400), and stores only a hash.
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            // Show the API's error (e.g. "email already registered").
            if (!response.ok) {
                setError(data.error || "Registration failed.");
                return;
            }

            // Success → go to the login page to sign in with the new account.
            router.push("/login");
        } catch {
            // Network error or non-JSON response.
            setError("An error occurred while registering.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
            {/* Centered card with heading and the sign-up form */}
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">
                        Create Account
                    </h1>

                    <p className="mt-2 text-slate-400">
                        Start managing your expenses today.
                    </p>
                </div>

                {/* Browser checks (required, type="email", minLength) give instant feedback;
                    the API repeats these checks because the browser can be bypassed */}
                <form onSubmit={handleRegister} className="space-y-5 mt-8">
                    <div>
                        <label className="mb-2 block text-sm font-medium">
                            Name
                        </label>

                        <input type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Keerthi"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" required />
                    </div>
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

                        {/* minLength={6} matches the server's 6-character minimum */}
                        <input type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="******"
                            minLength={6}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" required />
                    </div>

                    {/* Disabled while the request is running to prevent double sign-ups */}
                    <button type="submit" disabled={loading}
                        className="w-full rounded-lg bg-cyan-500 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
                        {loading ? "Creating account..." : "Register"}
                    </button>

                    {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

                    {/* Link back to login for existing users */}
                    <p className="mt-6 text-center text-sm text-slate-400">Already have an account?{" "}
                        <Link href="/login" className="text-cyan-400 hover:underline">
                            Login
                        </Link>
                    </p>
                </form>
            </div>
        </main>
    )
}