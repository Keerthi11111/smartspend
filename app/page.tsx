/**
 * FILE: app/page.tsx
 * ROUTE: /
 *
 * WHAT IT DOES: The landing page, the FIRST page every visitor sees. It shows a
 * short headline about the app and two buttons: "Get Started" (→ /login) and
 * "View Dashboard" (→ /dashboard).
 * WHERE IT FITS: Step 1 of the user journey. It is wrapped by app/layout.tsx. The links
 * lead to app/login/page.tsx or app/dashboard/page.tsx. If the visitor isn't logged in,
 * proxy.ts sends "View Dashboard" to /login?next=/dashboard. It calls no APIs and no DB.
 * WHY THIS CODE: It has no "use client" because it has no state or event handlers,
 * so it is a Server Component. The HTML is built on the server and sends no extra
 * JavaScript, which makes it fast. <Link> gives fast client-side navigation and prefetching.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import Link from "next/link";

// The default export of page.tsx is what Next.js renders for this URL.
export default function Home() {
    return (
        <main className="min-h-screen bg-slate-950 text-white">
            {/* Center the content both vertically and horizontally on the screen */}
            <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
                <div className="max-w-3xl text-center">
                    {/* Hero text: small label, big headline, short description */}
                    <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-cyan-400">
                        Personal Finance
                    </p>

                    <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
                        Manage your money
                        <span className="block text-cyan-400">
                            with confidence.
                        </span>
                    </h1>

                    <p className="mt-6 text-lg leading-8 text-slate-400">
                        Track expenses, manage budgets and understand your financial habits from one simple dashboard.
                    </p>

                    {/* Call-to-action buttons. Logged-in users who click "Get Started" are sent on to
                        /dashboard by proxy.ts; logged-out users clicking "View Dashboard" go to /login. */}
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