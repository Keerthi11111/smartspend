/**
 * FILE: app/dashboard/recurring/page.tsx
 * ROUTE: /dashboard/recurring
 *
 * WHAT IT DOES: Lists repeating bills and income (rent, subscriptions, EMIs, salary) with
 *   their next due date and a colored "due" badge. The user can mark an item as
 *   paid/received (records a transaction and moves to the next date), skip it,
 *   pause/resume it, edit it or delete it. Shows monthly totals at the top.
 *
 * WHERE IT FITS: Reached from the "Bills & Recurring" link in the Sidebar. The Calendar page
 *   also shows these items as upcoming bills.
 *   API calls: GET/POST /api/recurring, PUT/DELETE /api/recurring/[id],
 *   POST /api/recurring/[id]/pay, plus GET /api/categories and GET /api/accounts
 *   (for the dropdowns in the form).
 *
 * WHY THIS CODE: "use client" because it uses state, effects and button clicks. Data is loaded
 *   in useEffect and re-loaded by bumping "reloadKey" after every change, so the
 *   list always matches the server. Items with "Add automatically" on are posted
 *   by the server (lib/recurring.ts) when their date arrives; the others wait for
 *   the user to press "Paid". All row actions share one runAction() helper so the
 *   busy/error handling is written only once.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import {
    CalendarClock,
    Check,
    Pause,
    Pencil,
    Play,
    Plus,
    Repeat,
    SkipForward,
    Trash2,
    Zap,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import Modal from "../../components/Modal";
import FormError from "../../components/FormError";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";
import {
    apiFetch,
    errorMessage,
    inputClass,
    labelClass,
    primaryButtonClass,
    secondaryButtonClass,
} from "@/lib/client";

// How often an item repeats (matches the enum in prisma/schema.prisma).
type Frequency = "WEEKLY" | "MONTHLY" | "YEARLY";

// One recurring item as returned by GET /api/recurring (category and account names included).
interface RecurringItem {
    id: number;
    title: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    frequency: Frequency;
    nextDate: string;
    autoAdd: boolean;
    active: boolean;
    categoryId: number;
    accountId: number | null;
    category: { id: number; name: string; color: string };
    account: { id: number; name: string } | null;
}

// Minimal {id, name} shape, all we need for the category and account dropdowns.
interface Option {
    id: number;
    name: string;
}

// Display text for each frequency, also used to build the "Repeats" dropdown.
const frequencyLabels: Record<Frequency, string> = {
    WEEKLY: "Weekly",
    MONTHLY: "Monthly",
    YEARLY: "Yearly",
};

// Approximate monthly cost, for comparing weekly/monthly/yearly items
function monthlyAmount(item: RecurringItem) {
    if (item.frequency === "WEEKLY") return (item.amount * 52) / 12;
    if (item.frequency === "YEARLY") return item.amount / 12;
    return item.amount;
}

// Whole days from today until a date (negative = overdue).
// Both dates are set to midnight so the time of day doesn't change the answer.
function daysUntil(value: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const date = new Date(value);
    date.setHours(0, 0, 0, 0);

    return Math.round((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

// Picks the badge text and color for an item: Paused, Overdue, Due today, soon (<= 7 days) or later.
function dueBadge(item: RecurringItem) {
    if (!item.active) return { label: "Paused", className: "bg-slate-800 text-slate-400" };

    const days = daysUntil(item.nextDate);

    if (days < 0) {
        return {
            label: `Overdue ${Math.abs(days)}d`,
            className: "bg-red-500/15 text-red-400",
        };
    }
    if (days === 0) return { label: "Due today", className: "bg-amber-500/15 text-amber-400" };
    if (days <= 7) {
        return {
            label: `In ${days} day${days === 1 ? "" : "s"}`,
            className: "bg-amber-500/15 text-amber-400",
        };
    }

    return { label: `In ${days} days`, className: "bg-slate-800 text-slate-400" };
}

// Builds the full request body for PUT /api/recurring/[id].
// The API expects every field, so we copy the item and change only the fields in "overrides"
// (used by pause/resume, which changes only "active").
function itemBody(item: RecurringItem, overrides: Partial<RecurringItem> = {}) {
    const merged = { ...item, ...overrides };

    return {
        title: merged.title,
        amount: merged.amount,
        type: merged.type,
        frequency: merged.frequency,
        nextDate: toDateInputValue(merged.nextDate),
        autoAdd: merged.autoAdd,
        active: merged.active,
        categoryId: merged.categoryId,
        accountId: merged.accountId,
    };
}

// Main page component.
export default function RecurringPage() {
    // Data from the API (categories and accounts are only needed for the form dropdowns).
    const [items, setItems] = useState<RecurringItem[]>([]);
    const [categories, setCategories] = useState<Option[]>([]);
    const [accounts, setAccounts] = useState<Option[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    // Id of the row whose action is running, so only that row's buttons are disabled.
    const [busyId, setBusyId] = useState<number | null>(null);

    // Which modal is open: null = closed, "new" = add form, an item = edit that item.
    const [editing, setEditing] = useState<RecurringItem | "new" | null>(null);

    // Load all three lists in parallel when the page opens and whenever reloadKey changes.
    // The AbortController cancels the requests if the page unmounts or the effect re-runs.
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        Promise.all([
            apiFetch<RecurringItem[]>("/api/recurring", { signal }),
            apiFetch<Option[]>("/api/categories", { signal }),
            apiFetch<Option[]>("/api/accounts", { signal }),
        ])
            .then(([itemData, categoryData, accountData]) => {
                setItems(itemData);
                setCategories(categoryData);
                setAccounts(accountData);
                setError("");
            })
            .catch((error) => {
                if (!signal.aborted) setError(errorMessage(error));
            })
            .finally(() => {
                if (!signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [reloadKey]);

    // Call after any change to fetch fresh data.
    const reload = () => setReloadKey((key) => key + 1);

    // Derived totals, recalculated on every render from "items".
    // Paused items are ignored; weekly and yearly amounts are converted to a per-month figure.
    const active = items.filter((item) => item.active);
    const monthlyBills = active
        .filter((item) => item.type === "EXPENSE")
        .reduce((sum, item) => sum + monthlyAmount(item), 0);
    const monthlyIncome = active
        .filter((item) => item.type === "INCOME")
        .reduce((sum, item) => sum + monthlyAmount(item), 0);
    const dueSoon = active.filter((item) => daysUntil(item.nextDate) <= 7);

    // Shared wrapper for the row buttons: marks the row busy, runs the API call,
    // reloads on success and shows the error on failure.
    async function runAction(item: RecurringItem, action: () => Promise<unknown>) {
        try {
            setBusyId(item.id);
            setError("");
            await action();
            reload();
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setBusyId(null);
        }
    }

    // "Paid"/"Received" (skip = false): the server records a transaction and moves nextDate forward.
    // "Skip" (skip = true): the server only moves nextDate forward, no transaction is recorded.
    function pay(item: RecurringItem, skip = false) {
        if (skip && !window.confirm(`Skip this ${item.title} payment without recording it?`)) return;

        runAction(item, () =>
            apiFetch(`/api/recurring/${item.id}/pay`, { method: "POST", body: { skip } })
        );
    }

    // Pause or resume an item by saving it with "active" flipped.
    function toggleActive(item: RecurringItem) {
        runAction(item, () =>
            apiFetch(`/api/recurring/${item.id}`, {
                method: "PUT",
                body: itemBody(item, { active: !item.active }),
            })
        );
    }

    // Delete the recurring item. Transactions it already created stay in the history.
    function remove(item: RecurringItem) {
        if (!window.confirm(`Delete "${item.title}"? Past transactions are kept.`)) return;

        runAction(item, () => apiFetch(`/api/recurring/${item.id}`, { method: "DELETE" }));
    }

    return (
        <div>
            {/* Page header with the Add Recurring button (disabled until dropdown data has loaded) */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Bills & Recurring</h1>
                    <p className="mt-2 text-slate-400">
                        Rent, subscriptions, EMIs, salary: set them up once and never miss one.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setEditing("new")}
                    disabled={loading}
                    className={primaryButtonClass}
                >
                    <Plus size={18} />
                    Add Recurring
                </button>
            </div>

            {/* Error banner */}
            {error && (
                <p className="mt-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
            )}

            {/* Summary cards, only shown after loading and when there is at least one item */}
            {!loading && items.length > 0 && (
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                        <p className="text-sm text-slate-400">Bills per month</p>
                        <p className="mt-2 text-2xl font-bold text-red-400">
                            {formatCurrency(Math.round(monthlyBills))}
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                        <p className="text-sm text-slate-400">Recurring income per month</p>
                        <p className="mt-2 text-2xl font-bold text-emerald-400">
                            {formatCurrency(Math.round(monthlyIncome))}
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                        <p className="text-sm text-slate-400">Due in the next 7 days</p>
                        <p className="mt-2 text-2xl font-bold text-white">
                            {dueSoon.length}
                            <span className="ml-2 text-base font-normal text-slate-500">
                                {formatCurrency(
                                    dueSoon
                                        .filter((item) => item.type === "EXPENSE")
                                        .reduce((sum, item) => sum + item.amount, 0)
                                )}
                            </span>
                        </p>
                    </div>
                </div>
            )}

            {/* Loading text, empty state, or the list of items */}
            {loading ? (
                <p className="mt-8 text-slate-400">Loading...</p>
            ) : items.length === 0 ? (
                <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
                    <Repeat className="mx-auto text-slate-600" size={40} />
                    <p className="mt-4 text-slate-300">No recurring items yet.</p>
                    <p className="mt-2 text-sm text-slate-500">
                        Add bills like rent, Netflix or your phone plan, and income like your salary.
                    </p>
                </div>
            ) : (
                <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                    <ul className="divide-y divide-slate-800">
                        {items.map((item) => {
                            // Per-row values used several times below.
                            const badge = dueBadge(item);
                            const isIncome = item.type === "INCOME";
                            const busy = busyId === item.id;

                            return (
                                <li
                                    key={item.id}
                                    className={`flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between ${
                                        item.active ? "" : "opacity-60"
                                    }`}
                                >
                                    {/* Left side: icon, title, badges and details */}
                                    <div className="flex items-start gap-4">
                                        <div
                                            className="mt-0.5 rounded-lg p-2.5"
                                            style={{
                                                backgroundColor: `${item.category.color}20`,
                                                color: item.category.color,
                                            }}
                                        >
                                            <CalendarClock size={20} />
                                        </div>

                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium text-white">{item.title}</p>
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                                                >
                                                    {badge.label}
                                                </span>
                                                {/* "Auto" badge for items the server adds by itself on the due date */}
                                                {item.autoAdd && (
                                                    <span
                                                        className="flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-400"
                                                        title="Added to transactions automatically on the due date"
                                                    >
                                                        <Zap size={12} />
                                                        Auto
                                                    </span>
                                                )}
                                            </div>

                                            <p className="mt-1 text-sm text-slate-500">
                                                {frequencyLabels[item.frequency]} · {item.category.name}
                                                {item.account && ` · ${item.account.name}`}
                                                {" · Next: "}
                                                {formatDate(item.nextDate)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right side: amount and action buttons */}
                                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                        <span
                                            className={`mr-2 text-lg font-semibold ${
                                                isIncome ? "text-emerald-400" : "text-red-400"
                                            }`}
                                        >
                                            {isIncome ? "+" : "-"}
                                            {formatCurrency(item.amount)}
                                        </span>

                                        {/* Paid and Skip only make sense for active (not paused) items */}
                                        {item.active && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => pay(item)}
                                                    disabled={busy}
                                                    title={`Record ${isIncome ? "receipt" : "payment"} today and move to next date`}
                                                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
                                                >
                                                    <Check size={16} />
                                                    {isIncome ? "Received" : "Paid"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => pay(item, true)}
                                                    disabled={busy}
                                                    title="Skip this occurrence"
                                                    aria-label={`Skip ${item.title}`}
                                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                                                >
                                                    <SkipForward size={16} />
                                                </button>
                                            </>
                                        )}

                                        {/* Pause/Resume, Edit and Delete are always available */}
                                        <button
                                            type="button"
                                            onClick={() => toggleActive(item)}
                                            disabled={busy}
                                            title={item.active ? "Pause" : "Resume"}
                                            aria-label={`${item.active ? "Pause" : "Resume"} ${item.title}`}
                                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                                        >
                                            {item.active ? <Pause size={16} /> : <Play size={16} />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditing(item)}
                                            aria-label={`Edit ${item.title}`}
                                            className="rounded-lg p-2 text-cyan-400 hover:bg-cyan-400/10"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => remove(item)}
                                            disabled={busy}
                                            aria-label={`Delete ${item.title}`}
                                            className="rounded-lg p-2 text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Add/Edit modal, rendered only while open. On save: close it and reload. */}
            {editing && (
                <RecurringModal
                    item={editing === "new" ? null : editing}
                    categories={categories}
                    accounts={accounts}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        reload();
                    }}
                />
            )}
        </div>
    );
}

// Form modal used for BOTH adding and editing a recurring item (item = null means add).
function RecurringModal({
    item,
    categories,
    accounts,
    onClose,
    onSaved,
}: {
    item: RecurringItem | null;
    categories: Option[];
    accounts: Option[];
    onClose: () => void;
    onSaved: () => void;
}) {
    // Form field state, pre-filled from the item when editing.
    // Ids are kept as strings because <select> values are strings; we convert them on submit.
    const [title, setTitle] = useState(item?.title ?? "");
    const [type, setType] = useState<"EXPENSE" | "INCOME">(item?.type ?? "EXPENSE");
    const [amount, setAmount] = useState(item ? String(item.amount) : "");
    const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? "MONTHLY");
    const [nextDate, setNextDate] = useState(
        item ? toDateInputValue(item.nextDate) : toDateInputValue()
    );
    const [categoryId, setCategoryId] = useState(item ? String(item.categoryId) : "");
    const [accountId, setAccountId] = useState(item?.accountId ? String(item.accountId) : "");
    const [autoAdd, setAutoAdd] = useState(item?.autoAdd ?? false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Save the form (preventDefault stops the browser's default full-page submit).
    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");

            // Edit -> PUT /api/recurring/[id], Add -> POST /api/recurring.
            await apiFetch(item ? `/api/recurring/${item.id}` : "/api/recurring", {
                method: item ? "PUT" : "POST",
                body: {
                    title,
                    type,
                    amount: Number(amount),
                    frequency,
                    nextDate,
                    categoryId: Number(categoryId),
                    accountId: accountId ? Number(accountId) : null,
                    autoAdd,
                    // Keep the current paused/active state when editing; new items start active.
                    active: item?.active ?? true,
                },
            });

            onSaved();
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal title={item ? "Edit Recurring" : "Add Recurring"} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Expense / Income toggle buttons (aria-pressed tells screen readers which one is selected) */}
                <div className="grid grid-cols-2 gap-3">
                    {(["EXPENSE", "INCOME"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setType(value)}
                            aria-pressed={type === value}
                            className={`rounded-lg border px-4 py-2.5 font-medium transition ${
                                type === value
                                    ? value === "EXPENSE"
                                        ? "border-red-400 bg-red-400/10 text-red-400"
                                        : "border-emerald-400 bg-emerald-400/10 text-emerald-400"
                                    : "border-slate-700 text-slate-400 hover:bg-slate-800"
                            }`}
                        >
                            {value === "EXPENSE" ? "Bill / Expense" : "Income"}
                        </button>
                    ))}
                </div>

                <div>
                    <label htmlFor="recurring-title" className={labelClass}>
                        Title
                    </label>
                    <input
                        id="recurring-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={type === "EXPENSE" ? "Example: Netflix" : "Example: Salary"}
                        autoFocus
                        className={inputClass}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="recurring-amount" className={labelClass}>
                            Amount (₹)
                        </label>
                        <input
                            id="recurring-amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label htmlFor="recurring-frequency" className={labelClass}>
                            Repeats
                        </label>
                        <select
                            id="recurring-frequency"
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as Frequency)}
                            className={inputClass}
                        >
                            {Object.entries(frequencyLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* The first date this item is due; after each payment the server moves it forward */}
                <div>
                    <label htmlFor="recurring-next" className={labelClass}>
                        Next due date
                    </label>
                    <input
                        id="recurring-next"
                        type="date"
                        value={nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                        required
                        className={inputClass}
                    />
                </div>

                {/* Category (required) and Account (optional) */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="recurring-category" className={labelClass}>
                            Category
                        </label>
                        <select
                            id="recurring-category"
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            required
                            className={inputClass}
                        >
                            <option value="">Select</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="recurring-account" className={labelClass}>
                            Account
                        </label>
                        <select
                            id="recurring-account"
                            value={accountId}
                            onChange={(e) => setAccountId(e.target.value)}
                            className={inputClass}
                        >
                            <option value="">None</option>
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Auto-add checkbox: if on, the server records the transaction by itself on the due date */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 p-4">
                    <input
                        type="checkbox"
                        checked={autoAdd}
                        onChange={(e) => setAutoAdd(e.target.checked)}
                        className="mt-1 h-4 w-4 accent-cyan-500"
                    />
                    <span>
                        <span className="block font-medium text-white">Add automatically</span>
                        <span className="text-sm text-slate-400">
                            Record it as a transaction on the due date, for fixed amounts like rent,
                            SIPs or salary. Leave off to mark bills paid yourself.
                        </span>
                    </span>
                </label>

                <FormError message={error} />

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className={secondaryButtonClass}>
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className={primaryButtonClass}>
                        {saving ? "Saving..." : item ? "Save Changes" : "Add"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
