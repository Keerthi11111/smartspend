"use client";

import { Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Transaction {
    id: number;
    title: string;
    date: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    description: string | null;
    category: {
        id: number;
        name: string;
    };
}

export default function TransactionPage() {
    const router = useRouter();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    async function fetchTransactions(searchValue = "") {
        try {
            setLoading(true);

            const response = await fetch(
                `/api/transactions?search=${encodeURIComponent(searchValue)}`
            );

            if (response.status === 401) {
                window.location.href = "/login";
                return;
            }

            if (!response.ok) {
                throw new Error("Failed to fetch transactions");
            }

            const data = await response.json();

            setTransactions(data);
        } catch (error) {
            console.error("Fetch transactions error:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchTransactions();
    }, []);

    function handleSearch(value: string) {
        setSearch(value);
        fetchTransactions(value);
    }

    async function deleteTransaction(id: number) {
        const confirmDelete = window.confirm(
            "Are you sure you want to delete this transaction?"
        );

        if (!confirmDelete) {
            return;
        }

        try {
            setDeletingId(id);

            const response = await fetch(`/api/transactions/${id}`, {
                method: "DELETE",
            });

            if (response.status === 401) {
                window.location.href = "/login";
                return;
            }

            if (!response.ok) {
                throw new Error("Failed to delete transaction");
            }

            await fetchTransactions(search);
        } catch (error) {
            console.error("Delete transaction error:", error);
        } finally {
            setDeletingId(null);
        }
    }

    function handleNavigation() {
        router.push("/dashboard/transactions/add");
    }

    return (
        <div>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">
                        Transactions
                    </h1>

                    <p className="mt-2 text-slate-400">
                        Manage your income and expenses.
                    </p>
                </div>

                <div className="flex justify-between items-center gap-2">
                    <div className="relative max-w-md">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                            size={18}
                        />

                        <input
                            type="text"
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Search transactions..."
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleNavigation}
                        className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
                    >
                        <Plus size={18} />
                        Add Transaction
                    </button>
                </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-800 text-left text-sm text-slate-400">
                                <th className="px-5 py-4">Transaction</th>
                                <th className="px-5 py-4">Category</th>
                                <th className="px-5 py-4">Date</th>
                                <th className="px-5 py-4">Amount</th>
                                <th className="px-5 py-4">Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-5 py-10 text-center text-slate-400"
                                    >
                                        Loading transactions...
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-5 py-10 text-center text-slate-400"
                                    >
                                        No transactions found.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((transaction) => (
                                    <tr
                                        key={transaction.id}
                                        className="border-b border-slate-800 transition hover:bg-slate-800/40"
                                    >
                                        <td className="px-5 py-4">
                                            <div className="font-medium text-white">
                                                {transaction.title}
                                            </div>

                                            {transaction.description && (
                                                <div className="mt-1 text-sm text-slate-500">
                                                    {transaction.description}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-5 py-4 text-slate-400">
                                            {transaction.category?.name || "Uncategorized"}
                                        </td>

                                        <td className="px-5 py-4 text-slate-400">
                                            {new Date(transaction.date).toLocaleDateString("en-IN", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </td>

                                        <td
                                            className={`px-5 py-4 font-semibold ${transaction.type === "INCOME"
                                                ? "text-emerald-400"
                                                : "text-red-400"
                                                }`}
                                        >
                                            {transaction.type === "INCOME" ? "+" : "-"} ₹{" "}
                                            {transaction.amount.toLocaleString("en-IN")}
                                        </td>

                                        <td className="px-5 py-4">
                                            <button
                                                type="button"
                                                onClick={() => deleteTransaction(transaction.id)}
                                                disabled={deletingId === transaction.id}
                                                className="rounded-lg p-2 text-red-400 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                                                title="Delete transaction"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}