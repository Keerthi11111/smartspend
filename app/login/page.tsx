"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {

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

            if (!response.ok) {
                setError(data.error || "Login failed");
                return;
            }

            router.push("/dashboard");
        } catch {
            setError("Unexpected error occured");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
                <div className="mb-8">
                    <h1 className="mt-2 text-slate-400">
                        Welcome back
                    </h1>

                    <p className="mt-2 text-slate-400">
                        Login to your expense dashboard.
                    </p>
                </div>

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

                    <button type="submit" disabled={loading}
                        className="w-full rounded-lg bg-cyan-500 py-3 font-semibold text-slate-950 hover:bg-cyan-400">
                        {loading ? "Logged in..." : "Login"}
                    </button>

                    {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

                    <p className="mt-6 text-center text-sm text-slate-400">Don't have an account{" "}
                        <Link href="/register" className="text-cyan-400 hover:underline">
                            Register
                        </Link>
                    </p>
                </form>
            </div>
        </main>
    )
}