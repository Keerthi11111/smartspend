/**
 * FILE: app/dashboard/layout.tsx
 * ROUTE: wraps /dashboard and every /dashboard/* page
 *
 * WHAT IT DOES: The shared frame for all logged-in pages: the Sidebar on the
 * left, the Header on top, and the current page's content ({children}) in
 * the main area.
 * WHERE IT FITS: Next.js uses it automatically for every page inside
 * app/dashboard/. The user arrives here after logging in (/login sends them
 * to /dashboard). proxy.ts has already checked the login cookie before this
 * renders. The layout itself calls no API (Header and Sidebar do).
 * WHY THIS CODE:
 * - A layout.tsx means the Sidebar/Header are written once and stay mounted
 *   while you move between dashboard pages (only {children} changes).
 * - "use client" because it keeps the mobile sidebar's open/closed state in
 *   useState.
 * - The state lives here (the common parent) because two components need
 *   it: the Header's menu button opens the Sidebar, and the Sidebar closes
 *   itself. This is called "lifting state up".
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    // Is the sidebar drawer open on small screens? (On large screens it is always shown.)
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {/* Right-hand column. lg:ml-64 leaves room for the fixed 64-unit-wide sidebar. */}
            <div className="lg:ml-64">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                {/* The current dashboard page renders here */}
                <main className="p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}