"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="lg:ml-64">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                <main className="p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}