import Link from "next/link";

export default function Home() {
    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
                <div className="max-w-3xl text-center">
                    <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-cyan-400">
                        Personal Finance
                    </p>

                    <h1 className="text-5xl font-bold tracking-tiht md:text-6xl">
                        Manage your money
                        <span className="block text-cyan-400">
                            with confidence.
                        </span>
                    </h1>

                    <p className="mt-6 text-lg leading-8 text-slate-400">
                        Track expenses, manage budgets and understand your financial habits from one simple dashboard.
                    </p>

                    <div className="mt-8 flex justify-center gap-4">
                        <Link href="/login" className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400">
                            Get Started
                        </Link>

                        <Link href="/dashboard"
                            className="rounded-lg border border-slate-700 px-6 py-3 font-semibold transition hover:bg-slate-800">
                            View Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    )
}