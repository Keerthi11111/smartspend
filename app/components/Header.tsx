/**
 * FILE: app/components/Header.tsx
 * ROUTE: n/a (component)
 *
 * WHAT IT DOES: The top bar on every logged-in page. Shows a time-of-day
 * greeting, the logged-in user's name/email and an initials avatar, plus a
 * menu (☰) button that opens the Sidebar on mobile.
 * WHERE IT FITS: Rendered once by app/dashboard/layout.tsx above every
 * /dashboard/* page. Calls GET /api/auth/me to find out who is logged in.
 * WHY THIS CODE:
 * - "use client" because it uses useState/useEffect and an onClick handler.
 * - useEffect with an empty dependency list loads the user once, after the
 *   component first appears in the browser.
 * - A 401 from /api/auth/me means the cookie is missing/expired, so we send
 *   the user to /login.
 * - The menu button only calls onMenuClick; the layout owns the sidebar's
 *   open/closed state so Header and Sidebar can share it.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { Menu } from "lucide-react";
import { useEffect, useState } from "react";

// Props from the dashboard layout: called when the mobile menu button is clicked
interface HeaderProps {
    onMenuClick: () => void;
}

// Shape of the "user" object returned by GET /api/auth/me
interface CurrentUser {
    name: string;
    email: string;
}

// Picks "Good morning / afternoon / evening" from the browser's local clock
function greeting() {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

export default function Header({ onMenuClick }: HeaderProps) {
    // The logged-in user; null until /api/auth/me answers
    const [user, setUser] = useState<CurrentUser | null>(null);

    // Load the current user once when the header mounts.
    // API call: GET /api/auth/me (reads the "token" cookie on the server).
    useEffect(() => {
        async function loadUser() {
            try {
                const response = await fetch("/api/auth/me");

                if (response.status === 401) {
                    window.location.href = "/login";
                    return;
                }

                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                }
            } catch (error) {
                console.error("Load user error:", error);
            }
        }

        loadUser();
    }, []);

    // Derived value: up to two initials for the avatar, e.g. "Asha Rao" -> "AR".
    // Recomputed on every render, so it always matches the current user.
    const initials = user?.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <header className="flex h-20 items-center justify-between border-b border-slate-800 bg-slate-950 px-4 md:px-6">
            {/* Left side: mobile menu button + greeting */}
            <div className="flex items-center gap-3">
                <button onClick={onMenuClick}
                    className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden" aria-label="Open sidebar">
                    <Menu size={20} />
                </button>

                {/* suppressHydrationWarning: the server's clock/time zone may give a
                    different greeting than the browser's, and that mismatch is expected. */}
                <div>
                    <p className="text-sm text-slate-400" suppressHydrationWarning>
                        {greeting()}
                    </p>

                    <h2 className="text-lg font-semibold">
                        {user?.name ?? " "}
                    </h2>
                </div>
            </div>

            {/* Right side: user details and initials avatar (only once the user has loaded) */}
            {user && (
                <div className="flex items-center gap-3">
                    <div className="hidden text-right sm:block">
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                    </div>

                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-semibold text-cyan-400"
                        aria-hidden="true"
                    >
                        {initials}
                    </div>
                </div>
            )}
        </header>
    )
}
