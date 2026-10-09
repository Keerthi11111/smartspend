"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, LayoutDashboard, LogOut, Wallet, X } from "lucide-react";

const menuItems = [
    {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard
    },

    {
        name: "Transactions",
        href: "/dashboard/transactions",
        icon: CreditCard
    },
    {
        name: "Budget",
        href: "/dashboard/budgets",
        icon: Wallet
    },
    {
        name: "Reports",
        href: "/dashboard/reports",
        icon: BarChart3
    }
];

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();

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
            {isOpen && (
                <div className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={onClose} />
            )}

            <aside className={`fixed left-0 top-0 z-50 flex h-dvh w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>


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

                <nav className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                        {menuItems.map((item) => {
                            const Icon = item.icon;

                            const active = pathname === item.href;

                            return (
                                <Link key={item.name}
                                    href={item.href}
                                    onClick={onClose}
                                    className={`flex items-center gap-3 rounded-lg px-4 py-3 transition ${active ? "bg-cyan-500 text-slate-950" :
                                        "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
                                >
                                    <Icon size={20} />
                                    <span>{item.name}</span>
                                </Link>
                            )
                        })}
                    </div>
                </nav>


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