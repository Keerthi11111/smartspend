/**
 * FILE: app/components/Sidebar.tsx
 * ROUTE: n/a (component)
 *
 * WHAT IT DOES: The left-hand navigation menu shown on every logged-in page.
 * It lists all dashboard pages grouped into sections, highlights the page you
 * are on, and has a Logout button at the bottom.
 * WHERE IT FITS: Rendered once by app/dashboard/layout.tsx, so it appears on
 * every /dashboard/* page. On mobile it slides in when the Header's menu (☰)
 * button is clicked. Calls POST /api/auth/logout.
 * WHY THIS CODE:
 * - "use client" because it uses a hook (usePathname) and click handlers.
 * - The menu is a plain data array (menuSections) so adding a page means
 *   adding one line, not copying JSX.
 * - isOpen / onClose come from the layout (the parent owns the open state),
 *   because the Header button and this Sidebar both need to control it.
 * - After logout we use window.location.href (a full page load) instead of
 *   router.push, so all in-memory React state from the old session is wiped.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BarChart3,
    Bot,
    CalendarDays,
    CreditCard,
    HandCoins,
    Landmark,
    LayoutDashboard,
    LogOut,
    Repeat,
    Settings,
    Tags,
    Target,
    Wallet,
    X,
} from "lucide-react";

// All sidebar links, grouped into titled sections. The JSX below loops over
// this array, so the order here is the order the user sees.
const menuSections = [
    {
        title: "Overview",
        items: [
            { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { name: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
        ],
    },
    {
        title: "Money",
        items: [
            { name: "Transactions", href: "/dashboard/transactions", icon: CreditCard },
            { name: "Accounts", href: "/dashboard/accounts", icon: Landmark },
            { name: "Bills & Recurring", href: "/dashboard/recurring", icon: Repeat },
        ],
    },
    {
        title: "Planning",
        items: [
            { name: "Budget", href: "/dashboard/budgets", icon: Wallet },
            { name: "Savings Goals", href: "/dashboard/goals", icon: Target },
            { name: "Debts & Loans", href: "/dashboard/debts", icon: HandCoins },
        ],
    },
    {
        title: "Insights",
        items: [
            { name: "Reports", href: "/dashboard/reports", icon: BarChart3 },
            { name: "AI Assistant", href: "/dashboard/assistant", icon: Bot },
        ],
    },
    {
        title: "Manage",
        items: [
            { name: "Categories", href: "/dashboard/categories", icon: Tags },
            { name: "Settings", href: "/dashboard/settings", icon: Settings },
        ],
    },
];

// Props from the dashboard layout: whether the mobile drawer is open, and a
// function to close it.
interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    // Current URL path (e.g. "/dashboard/goals"), used to highlight the active link
    const pathname = usePathname();

    // Logout: ask the server to clear the "token" cookie, then go to /login.
    // A full page load (window.location) resets all React state.
    async function handleLogout() {
        try {

            const response = await fetch("/api/auth/logout", {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error("Logout failed");
            }

            window.location.href = "/login";

        } catch (error) {
            console.log("error:", error);
        }
    }

    return (
        <>
            {/* Dark overlay behind the open drawer (mobile only). Clicking it closes the sidebar. */}
            {isOpen && (
                <div className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={onClose} />
            )}

            {/* The sidebar itself. On mobile it slides in/out with translate-x;
                on large screens (lg:) it is always visible. */}
            <aside className={`fixed left-0 top-0 z-50 flex h-dvh w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>


                {/* Logo row */}
                <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-800 px-6">
                    <h1 className="text-xl font-bold">
                        Expense
                        <span className="text-cyan-400">
                            Pro
                        </span>
                    </h1>

                    {/* Close button - mobile only */}
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
                        aria-label="Close sidebar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation links, built from menuSections */}
                <nav className="scrollbar-none flex-1 overflow-y-auto px-4 py-3">
                    <div className="space-y-4">
                        {menuSections.map((section) => (
                            <div key={section.title}>
                                <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    {section.title}
                                </p>

                                <div className="space-y-1">
                                    {section.items.map((item) => {
                                        // Components must start with a capital letter in JSX
                                        const Icon = item.icon;

                                        // "/dashboard" must match exactly, otherwise it would be
                                        // highlighted on every page (all start with /dashboard).
                                        // Other links also match their sub-pages (e.g. /add, /[id]/edit).
                                        const active =
                                            item.href === "/dashboard"
                                                ? pathname === item.href
                                                : pathname.startsWith(item.href);

                                        return (
                                            <Link key={item.name}
                                                href={item.href}
                                                onClick={onClose}
                                                className={`flex items-center gap-3 rounded-lg px-4 py-2 transition ${active ? "bg-cyan-500 text-slate-950" :
                                                    "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
                                            >
                                                <Icon size={20} />
                                                <span>{item.name}</span>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </nav>


                {/* Logout button, pinned to the bottom */}
                <div className="shrink-0 border-t border-slate-800 p-4">
                    <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-slate-400 hover:text-white"
                        onClick={handleLogout}>
                        <LogOut size={20} />
                        Logout
                    </button>
                </div>
            </aside>
        </>
    )
}