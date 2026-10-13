/**
 * FILE: app/dashboard/transactions/page.tsx
 * ROUTE: /dashboard/transactions   (optionally ?accountId=<id>)
 *
 * WHAT IT DOES: Lists all your income and expense transactions in a table,
 * with search, type (income/expense), date-period and account filters,
 * totals for the current filter, CSV export, and edit/delete buttons per row.
 * WHERE IT FITS: "Transactions" link in the Sidebar, "View all" on the
 * Dashboard, and account cards on /dashboard/accounts (which add
 * ?accountId=). Links to /dashboard/transactions/add and
 * /dashboard/transactions/[id]/edit. API calls: GET /api/accounts,
 * GET /api/transactions?search=&type=&from=&to=&accountId=, and
 * DELETE /api/transactions/[id].
 * WHY THIS CODE:
 * - "use client" because of state, effects, and click handlers.
 * - Filtering happens on the SERVER (filters are sent as query params), so
 *   the browser never has to download every transaction.
 * - The search box is "debounced" (waits 300 ms after typing stops) so we
 *   don't send a request on every key press.
 * - AbortController cancels an older request when filters change, so a slow
 *   old response can't overwrite newer results.
 * - useMemo recalculates the income/expense totals only when the list changes.
 * - After a delete we bump `reloadKey` to re-run the fetch effect, instead of
 *   duplicating the fetch code.
 * - useSearchParams (reading ?accountId=) requires a <Suspense> wrapper in
 *   Next.js, which is why the page is split into TransactionPage + TransactionList.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";
import { redirectToLogin } from "@/lib/redirect";

// One transaction as returned by GET /api/transactions (with its category
// and, if set, its account included)
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
    account: {
        id: number;
        name: string;
    } | null;
}

// Only what the "Filter by account" dropdown needs
interface AccountOption {
    id: number;
    name: string;
}

// Allowed values for the type and date-period filters. Using union types
// means TypeScript catches typos like "INCOMES".
type TypeFilter = "ALL" | "INCOME" | "EXPENSE";
type PeriodFilter = "all" | "this-month" | "last-month" | "last-90" | "custom";

// Options for the date-period dropdown (value is stored, label is shown)
const periodOptions: { value: PeriodFilter; label: string }[] = [
    { value: "all", label: "All time" },
    { value: "this-month", label: "This month" },
    { value: "last-month", label: "Last month" },
    { value: "last-90", label: "Last 90 days" },
    { value: "custom", label: "Custom range" },
];

// Converts the chosen period into "from"/"to" dates (yyyy-mm-dd strings)
// that the API understands. An empty string means "no limit on that side".
// e.g. "last-month": day 1 of last month -> day 0 of this month (= last day of last month).
function periodRange(period: PeriodFilter, customFrom: string, customTo: string) {
    const now = new Date();

    switch (period) {
        case "this-month":
            return {
                from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
                to: "",
            };
        case "last-month":
            return {
                from: toDateInputValue(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
                to: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 0)),
            };
        case "last-90":
            return {
                from: toDateInputValue(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000)),
                to: "",
            };
        case "custom":
            return { from: customFrom, to: customTo };
        default:
            return { from: "", to: "" };
    }
}

// Downloads the currently shown transactions as a .csv file, entirely in the
// browser (no API call): build the text, wrap it in a Blob, and click a
// temporary <a download> link.
function exportCsv(transactions: Transaction[]) {
    // Wrap every value in quotes and double any quotes inside it, so commas
    // or quotes in titles don't break the CSV columns
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const rows = [
        ["Date", "Title", "Type", "Category", "Account", "Amount", "Description"],
        ...transactions.map((t) => [
            toDateInputValue(t.date),
            t.title,
            t.type,
            t.category?.name ?? "",
            t.account?.name ?? "",
            String(t.amount),
            t.description ?? "",
        ]),
    ];

    const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));

    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${toDateInputValue()}.csv`;
    link.click();

    // Free the temporary URL's memory once the download has started
    URL.revokeObjectURL(url);
}

// Shared Tailwind classes for the filter inputs/selects
const fieldClass =
    "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400";

// useSearchParams needs a Suspense boundary so the rest of the page can prerender
export default function TransactionPage() {
    return (
        <Suspense>
            <TransactionList />
        </Suspense>
    );
}

// The real page content (inside the Suspense boundary above)
function TransactionList() {
    // Reads the URL query string, e.g. ?accountId=3
    const searchParams = useSearchParams();
    // The transactions currently shown in the table
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    // Filter state. `search` updates on every key press; `debouncedSearch`
    // copies it 300 ms after typing stops and is what actually triggers a fetch.
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
    const [period, setPeriod] = useState<PeriodFilter>("all");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    // Account cards link here with ?accountId=
    const [accountFilter, setAccountFilter] = useState(
        () => searchParams.get("accountId") ?? ""
    );
    // Options for the account filter dropdown
    const [accounts, setAccounts] = useState<AccountOption[]>([]);
    // Request status. deletingId disables the delete button of the row being
    // deleted; reloadKey is a counter we bump to force a re-fetch.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    // Debounce the search box: wait 300 ms after the last key press.
    // If the user types again sooner, the cleanup cancels the old timer.
    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timeout);
    }, [search]);

    // Load the accounts once for the filter dropdown.
    // API call: GET /api/accounts. If it fails we just use an empty list
    // (the dropdown is then hidden), since this filter is optional.
    useEffect(() => {
        fetch("/api/accounts")
            .then((response) => (response.ok ? response.json() : []))
            .then(setAccounts)
            .catch((error) => console.error("Load accounts error:", error));
    }, []);

    // Derived value: the date range for the chosen period. These are plain
    // strings, so the effect below only re-runs when the dates really change.
    const { from, to } = periodRange(period, customFrom, customTo);

    // Fetch the transactions whenever any filter (or reloadKey) changes.
    // API call: GET /api/transactions?search=&type=&from=&to=&accountId=
    // The AbortController cancels this request if the filters change again
    // before it finishes (the cleanup function calls controller.abort()).
    useEffect(() => {
        const controller = new AbortController();

        async function fetchTransactions() {
            try {
                setLoading(true);
                setError("");

                // Only add query params for filters that are actually set
                const params = new URLSearchParams();
                if (debouncedSearch) params.set("search", debouncedSearch);
                if (typeFilter !== "ALL") params.set("type", typeFilter);
                if (from) params.set("from", from);
                if (to) params.set("to", to);
                if (accountFilter) params.set("accountId", accountFilter);

                const response = await fetch(`/api/transactions?${params}`, {
                    signal: controller.signal,
                });

                if (response.status === 401) {
                    window.location.href = "/login";
                    return;
                }

                if (!response.ok) {
                    throw new Error("Failed to fetch transactions");
                }

                setTransactions(await response.json());
            } catch (error) {
                // A cancelled request is expected, not a real error
                if (controller.signal.aborted) return;

                console.error("Fetch transactions error:", error);
                setError("Unable to load transactions. Please try again.");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        fetchTransactions();

        return () => controller.abort();
    }, [debouncedSearch, typeFilter, from, to, accountFilter, reloadKey]);

    // Derived value: income, expense and net totals for the rows on screen.
    // useMemo skips this loop on re-renders where `transactions` hasn't changed
    // (e.g. while typing in the search box).
    const totals = useMemo(() => {
        let income = 0;
        let expense = 0;

        for (const transaction of transactions) {
            if (transaction.type === "INCOME") income += transaction.amount;
            else expense += transaction.amount;
        }

        return { income, expense, net: income - expense };
    }, [transactions]);

    // Handler for the trash button: ask for confirmation, then
    // API call: DELETE /api/transactions/[id]. On success, bump reloadKey so
    // the fetch effect runs again and the list (and totals) refresh.
    async function deleteTransaction(transaction: Transaction) {
        const confirmDelete = window.confirm(
            `Delete "${transaction.title}" (${formatCurrency(transaction.amount)})?`
        );

        if (!confirmDelete) {
            return;
        }

        try {
            setDeletingId(transaction.id);

            const response = await fetch(`/api/transactions/${transaction.id}`, {
                method: "DELETE",
            });

            if (response.status === 401) {
                redirectToLogin();
                return;
            }

            if (!response.ok) {
                throw new Error("Failed to delete transaction");
            }

            setReloadKey((key) => key + 1);
        } catch (error) {
            console.error("Delete transaction error:", error);
            setError("Failed to delete transaction.");
        } finally {
            setDeletingId(null);
        }
    }

    // Derived value: is any filter active? Shows the "Clear" button and
    // picks the right "no results" message.
    const hasFilters =
        search !== "" || typeFilter !== "ALL" || period !== "all" || accountFilter !== "";

    return (
        <div>
            {/* Page heading + Export CSV / Add Transaction buttons */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">
                        Transactions
                    </h1>

                    <p className="mt-2 text-slate-400">
                        Manage your income and expenses.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => exportCsv(transactions)}
                        disabled={transactions.length === 0}
                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Download size={18} />
                        Export CSV
                    </button>

                    <Link
                        href="/dashboard/transactions/add"
                        className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
                    >
                        <Plus size={18} />
                        Add Transaction
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:flex-row lg:items-center">
                {/* Search box (debounced, see the effect above) */}
                <div className="relative flex-1">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        size={18}
                    />

                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search title, description or category..."
                        aria-label="Search transactions"
                        className={`${fieldClass} w-full pl-10`}
                    />
                </div>

                {/* All / Income / Expense toggle */}
                <div
                    role="group"
                    aria-label="Filter by type"
                    className="flex rounded-lg border border-slate-700 p-1"
                >
                    {(["ALL", "INCOME", "EXPENSE"] as TypeFilter[]).map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setTypeFilter(value)}
                            aria-pressed={typeFilter === value}
                            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                                typeFilter === value
                                    ? "bg-slate-700 text-white"
                                    : "text-slate-400 hover:text-white"
                            }`}
                        >
                            {value === "ALL" ? "All" : value === "INCOME" ? "Income" : "Expense"}
                        </button>
                    ))}
                </div>

                {/* Date period dropdown */}
                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
                    aria-label="Filter by date"
                    className={fieldClass}
                >
                    {periodOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                {/* Account dropdown, only if the user has any accounts */}
                {accounts.length > 0 && (
                    <select
                        value={accountFilter}
                        onChange={(e) => setAccountFilter(e.target.value)}
                        aria-label="Filter by account"
                        className={fieldClass}
                    >
                        <option value="">All accounts</option>
                        {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                                {account.name}
                            </option>
                        ))}
                    </select>
                )}

                {/* From/To date pickers, only for "Custom range". min stops "to" being before "from". */}
                {period === "custom" && (
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={customFrom}
                            onChange={(e) => setCustomFrom(e.target.value)}
                            aria-label="From date"
                            className={fieldClass}
                        />
                        <span className="text-slate-500">to</span>
                        <input
                            type="date"
                            value={customTo}
                            min={customFrom || undefined}
                            onChange={(e) => setCustomTo(e.target.value)}
                            aria-label="To date"
                            className={fieldClass}
                        />
                    </div>
                )}

                {/* Clear: reset every filter back to its default */}
                {hasFilters && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearch("");
                            setTypeFilter("ALL");
                            setPeriod("all");
                            setAccountFilter("");
                        }}
                        className="text-sm text-cyan-400 hover:text-cyan-300"
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Totals for current filter */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
                    <p className="text-slate-500">Income</p>
                    <p className="mt-1 font-semibold text-emerald-400">
                        {formatCurrency(totals.income)}
                    </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
                    <p className="text-slate-500">Expenses</p>
                    <p className="mt-1 font-semibold text-red-400">
                        {formatCurrency(totals.expense)}
                    </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
                    <p className="text-slate-500">Net</p>
                    <p
                        className={`mt-1 font-semibold ${
                            totals.net >= 0 ? "text-white" : "text-red-400"
                        }`}
                    >
                        {totals.net < 0 ? "-" : ""}
                        {formatCurrency(Math.abs(totals.net))}
                    </p>
                </div>
            </div>

            {/* Error message (load or delete failed) */}
            {error && (
                <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                    {error}
                </p>
            )}

            {/* Transactions table. overflow-x-auto lets it scroll sideways on small screens. */}
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-800 text-left text-sm text-slate-400">
                                <th className="px-5 py-4">Transaction</th>
                                <th className="px-5 py-4">Category</th>
                                <th className="px-5 py-4">Date</th>
                                <th className="px-5 py-4 text-right">Amount</th>
                                <th className="px-5 py-4 text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {/* Three cases: first load -> "Loading...", no rows -> empty message,
                                otherwise the rows. While re-loading with old rows on screen,
                                the rows are faded (opacity-60) instead of disappearing. */}
                            {loading && transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                                        Loading transactions...
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                                        {hasFilters
                                            ? "No transactions match these filters."
                                            : "No transactions yet. Add your first one to get started."}
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((transaction) => (
                                    <tr
                                        key={transaction.id}
                                        className={`border-b border-slate-800 transition hover:bg-slate-800/40 ${
                                            loading ? "opacity-60" : ""
                                        }`}
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

                                        <td className="px-5 py-4">
                                            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                                                {transaction.category?.name || "Uncategorized"}
                                            </span>

                                            {transaction.account && (
                                                <div className="mt-1.5 text-xs text-slate-500">
                                                    {transaction.account.name}
                                                </div>
                                            )}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-slate-400">
                                            {formatDate(transaction.date)}
                                        </td>

                                        <td
                                            className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${
                                                transaction.type === "INCOME"
                                                    ? "text-emerald-400"
                                                    : "text-red-400"
                                            }`}
                                        >
                                            {transaction.type === "INCOME" ? "+" : "-"}
                                            {formatCurrency(transaction.amount)}
                                        </td>

                                        {/* Row actions: edit page link and delete button */}
                                        <td className="px-5 py-4">
                                            <div className="flex justify-end gap-1">
                                                <Link
                                                    href={`/dashboard/transactions/${transaction.id}/edit`}
                                                    className="rounded-lg p-2 text-cyan-400 transition hover:bg-cyan-400/10"
                                                    title="Edit transaction"
                                                    aria-label={`Edit ${transaction.title}`}
                                                >
                                                    <Pencil size={18} />
                                                </Link>

                                                <button
                                                    type="button"
                                                    onClick={() => deleteTransaction(transaction)}
                                                    disabled={deletingId === transaction.id}
                                                    className="rounded-lg p-2 text-red-400 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                                                    title="Delete transaction"
                                                    aria-label={`Delete ${transaction.title}`}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
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
