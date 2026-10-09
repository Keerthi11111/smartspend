"use client";

import { Bell, User, Menu } from "lucide-react";

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    return (
        <header className="flex h-20 items-center justify-between border-b border-slate-800 bg-slate-950 px-4 md:px-6">
            <div className="flex justify-between gap-2 items-center">
                <div className="flex items-center gap-3">
                    <button onClick={onMenuClick}
                        className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden" aria-label="Open sidebar">
                        <Menu size={20} />
                    </button>
                </div>

                <div>
                    <p className="text-sm text-slate-400">
                        Welcome back
                    </p>

                    <h2 className="text-lg font-semibold">
                        Keerthi
                    </h2>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                    <Bell size={20} />
                </button>

                <button className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2">
                    <User size={18} />
                    <span className="hidden sm:block">Keerthi</span>
                </button>
            </div>
        </header>
    )
}