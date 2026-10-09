"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleRegister(e: FormEvent) {
        e.preventDefault();

        setError("");

        setLoading(true);

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Registration failed.");
                return;
            }

            router.push("/login");
        } catch {
            setError("An error occurred while registering.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">
                        Create Account
                    </h1>

                    <p className="mt-2 text-slate-400">
                        Start managing your expenses today.
                    </p>
                </div>

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

                        <input type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="******"
                            minLength={6}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" required />
                    </div>

                    <button type="submit" disabled={loading}
                        className="w-full rounded-lg bg-cyan-500 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
                        {loading ? "Creating account..." : "Register"}
                    </button>

                    {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

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