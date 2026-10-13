/**
 * FILE: app/dashboard/debts/page.tsx
 * ROUTE: /dashboard/debts
 *
 * WHAT IT DOES: Tracks money you lent to people ("LENT") or borrowed from them
 * ("BORROWED"). Shows totals (others owe you / you owe / net), Open and Settled
 * tabs, and a card per record where you can record a part payment, mark it
 * settled, reopen it, edit or delete it.
 * WHERE IT FITS: Reached from the "Debts & Loans" link in the Sidebar. Calls
 * GET /api/debts (list), POST /api/debts (create), PUT /api/debts/[id] (edit),
 * PATCH /api/debts/[id] (payment / settle / reopen) and DELETE /api/debts/[id].
 * WHY THIS CODE: "use client" because it uses state, effects and click handlers.
 * All debts are loaded once in useEffect; the tabs and totals are then worked out
 * in the browser from that one list, so switching tabs needs no extra request.
 * After any change, `reloadKey` is bumped to re-fetch fresh data from the server.
 * Forms live in modals (shared Modal component) so the user stays on the list.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { ArrowDownLeft, ArrowUpRight, CheckCircle2, HandCoins, Pencil, RotateCcw, Trash2 } from "lucide-react";
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

// LENT = someone owes you money; BORROWED = you owe someone money.
type DebtType = "LENT" | "BORROWED";

// Shape of one debt record from GET /api/debts.
// paidAmount = how much has been paid back so far.
// settledAt is null while the debt is still open, and a date once it is fully paid.
interface Debt {
    id: number;
    personName: string;
    type: DebtType;
    amount: number;
    paidAmount: number;
    note: string | null;
    date: string;
    dueDate: string | null;
    settledAt: string | null;
}

// The two tabs shown above the list.
type Tab = "open" | "settled";

export default function DebtsPage() {
    // List data, loading/error flags, reload counter and the active tab.
    const [debts, setDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [tab, setTab] = useState<Tab>("open");

    // Which modal is open:
    // - editing: null = closed, "LENT"/"BORROWED" = new record of that type,
    //   a Debt object = edit that record
    // - paying: the debt we are recording a part payment for
    const [editing, setEditing] = useState<Debt | DebtType | null>(null);
    const [paying, setPaying] = useState<Debt | null>(null);

    // Load all debts on first render and whenever reloadKey changes.
    // apiFetch (lib/client.ts) handles JSON, errors and 401 -> login redirect.
    // The AbortController cancels the request if the page unmounts first.
    useEffect(() => {
        const controller = new AbortController();

        // API call: GET /api/debts.
        apiFetch<Debt[]>("/api/debts", { signal: controller.signal })
            .then((data) => {
                setDebts(data);
                setError("");
            })
            .catch((error) => {
                if (!controller.signal.aborted) setError(errorMessage(error));
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [reloadKey]);

    // Call this after any change to re-fetch the list.
    const reload = () => setReloadKey((key) => key + 1);

    // Derived values (recomputed every render from `debts`):
    // - open: records not yet settled
    // - outstanding(type): total still unpaid for LENT or BORROWED
    // - visible: the records shown for the currently selected tab
    const open = debts.filter((debt) => !debt.settledAt);
    const outstanding = (type: DebtType) =>
        open
            .filter((debt) => debt.type === type)
            .reduce((sum, debt) => sum + debt.amount - debt.paidAmount, 0);

    const owedToYou = outstanding("LENT");
    const youOwe = outstanding("BORROWED");
    const visible = tab === "open" ? open : debts.filter((debt) => debt.settledAt);

    // Shared helper for the quick actions ("Mark settled", "Reopen").
    // Optionally asks for confirmation, then sends PATCH /api/debts/[id]
    // with a body like { settle: true } or { reopen: true }, and reloads.
    async function patch(debt: Debt, body: object, confirmText?: string) {
        if (confirmText && !window.confirm(confirmText)) return;

        try {
            await apiFetch(`/api/debts/${debt.id}`, { method: "PATCH", body });
            reload();
        } catch (error) {
            setError(errorMessage(error));
        }
    }

    // Delete a record after confirming: DELETE /api/debts/[id], then reload.
    async function remove(debt: Debt) {
        if (!window.confirm(`Delete this record with ${debt.personName}?`)) return;

        try {
            await apiFetch(`/api/debts/${debt.id}`, { method: "DELETE" });
            reload();
        } catch (error) {
            setError(errorMessage(error));
        }
    }

    return (
        <div>
            {/* Heading + "I Borrowed" / "I Lent" buttons (each opens the create modal pre-set to that type) */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Debts & Loans</h1>
                    <p className="mt-2 text-slate-400">
                        Keep track of money you&apos;ve lent to or borrowed from friends and family.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setEditing("BORROWED")}
                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 font-medium text-slate-300 transition hover:bg-slate-800"
                    >
                        <ArrowDownLeft size={18} />
                        I Borrowed
                    </button>
                    <button type="button" onClick={() => setEditing("LENT")} className={primaryButtonClass}>
                        <ArrowUpRight size={18} />
                        I Lent
                    </button>
                </div>
            </div>

            {/* Summary cards: owed to you, you owe, and the net (shown red with "-" when negative) */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">Others owe you</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-400">{formatCurrency(owedToYou)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">You owe others</p>
                    <p className="mt-2 text-2xl font-bold text-red-400">{formatCurrency(youOwe)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">Net</p>
                    <p
                        className={`mt-2 text-2xl font-bold ${
                            owedToYou - youOwe < 0 ? "text-red-400" : "text-white"
                        }`}
                    >
                        {owedToYou - youOwe < 0 ? "-" : ""}
                        {formatCurrency(Math.abs(owedToYou - youOwe))}
                    </p>
                </div>
            </div>

            {error && (
                <p className="mt-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
            )}

            {/* Open / Settled tabs. Only changes `tab`; filtering happens in `visible` above. */}
            <div role="tablist" className="mt-6 flex w-fit rounded-lg border border-slate-700 p-1">
                {(["open", "settled"] as Tab[]).map((value) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={tab === value}
                        onClick={() => setTab(value)}
                        className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                            tab === value ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                        }`}
                    >
                        {value === "open" ? `Open (${open.length})` : `Settled (${debts.length - open.length})`}
                    </button>
                ))}
            </div>

            {/* Loading text, empty state, or the grid of debt cards */}
            {loading ? (
                <p className="mt-6 text-slate-400">Loading...</p>
            ) : visible.length === 0 ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
                    <HandCoins className="mx-auto text-slate-600" size={40} />
                    <p className="mt-4 text-slate-300">
                        {tab === "open" ? "You're all square. Nothing outstanding." : "No settled records yet."}
                    </p>
                </div>
            ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {visible.map((debt) => {
                        // Per-card values: direction, amount still unpaid, % paid back,
                        // and whether an open debt is past its due date.
                        const lent = debt.type === "LENT";
                        const remaining = debt.amount - debt.paidAmount;
                        const percentage = (debt.paidAmount / debt.amount) * 100;
                        const overdue =
                            !debt.settledAt && debt.dueDate && new Date(debt.dueDate) < new Date();

                        return (
                            <div key={debt.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                                {/* Header: initial-letter avatar (green = lent, red = borrowed), name, date, edit/delete */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                                                lent ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                                            }`}
                                            aria-hidden="true"
                                        >
                                            {debt.personName.slice(0, 1).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{debt.personName}</p>
                                            <p className="text-xs text-slate-500">
                                                {lent ? "You lent" : "You borrowed"} · {formatDate(debt.date)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setEditing(debt)}
                                            aria-label={`Edit record with ${debt.personName}`}
                                            className="rounded-lg p-2 text-cyan-400 hover:bg-cyan-400/10"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => remove(debt)}
                                            aria-label={`Delete record with ${debt.personName}`}
                                            className="rounded-lg p-2 text-red-400 hover:bg-red-400/10"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Amount (remaining if open, full amount if settled) + settled/due date label */}
                                <div className="mt-4 flex items-end justify-between">
                                    <p className={`text-xl font-bold ${lent ? "text-emerald-400" : "text-red-400"}`}>
                                        {formatCurrency(debt.settledAt ? debt.amount : remaining)}
                                        {!debt.settledAt && debt.paidAmount > 0 && (
                                            <span className="ml-2 text-sm font-normal text-slate-500">
                                                of {formatCurrency(debt.amount)}
                                            </span>
                                        )}
                                    </p>

                                    {debt.settledAt ? (
                                        <span className="flex items-center gap-1 text-sm text-emerald-400">
                                            <CheckCircle2 size={16} />
                                            Settled {formatDate(debt.settledAt, { day: "2-digit", month: "short" })}
                                        </span>
                                    ) : (
                                        debt.dueDate && (
                                            <span className={`text-sm ${overdue ? "text-red-400" : "text-slate-400"}`}>
                                                {overdue ? "Overdue since" : "Due"} {formatDate(debt.dueDate)}
                                            </span>
                                        )
                                    )}
                                </div>

                                {/* Repayment progress bar, only once part of the debt has been paid */}
                                {!debt.settledAt && debt.paidAmount > 0 && (
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                                        <div
                                            className={`h-full rounded-full ${lent ? "bg-emerald-500" : "bg-red-500"}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                )}

                                {debt.note && <p className="mt-3 text-sm text-slate-400">{debt.note}</p>}

                                {/* Actions: settled records can be reopened; open ones can get a payment or be marked settled */}
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {debt.settledAt ? (
                                        <button
                                            type="button"
                                            onClick={() => patch(debt, { reopen: true }, "Mark this as unpaid again?")}
                                            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                                        >
                                            <RotateCcw size={14} />
                                            Reopen
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setPaying(debt)}
                                                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                                            >
                                                Record payment
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    patch(
                                                        debt,
                                                        { settle: true },
                                                        `Mark the full ${formatCurrency(remaining)} as ${lent ? "received" : "paid back"}?`
                                                    )
                                                }
                                                className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25"
                                            >
                                                <CheckCircle2 size={14} />
                                                Mark settled
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/edit modal. After saving, switch to the Open tab so the record is visible, and reload. */}
            {editing && (
                <DebtModal
                    debt={typeof editing === "string" ? null : editing}
                    defaultType={typeof editing === "string" ? editing : editing.type}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        setTab("open");
                        reload();
                    }}
                />
            )}

            {/* Part-payment modal */}
            {paying && (
                <PaymentModal
                    debt={paying}
                    onClose={() => setPaying(null)}
                    onSaved={() => {
                        setPaying(null);
                        reload();
                    }}
                />
            )}
        </div>
    );
}

// Modal for creating (debt = null) or editing a debt record.
// defaultType decides whether a new record starts as "I lent" or "I borrowed".
function DebtModal({
    debt,
    defaultType,
    onClose,
    onSaved,
}: {
    debt: Debt | null;
    defaultType: DebtType;
    onClose: () => void;
    onSaved: () => void;
}) {
    // Form fields, pre-filled from the existing record when editing.
    // The date defaults to today for new records.
    const [type, setType] = useState<DebtType>(defaultType);
    const [personName, setPersonName] = useState(debt?.personName ?? "");
    const [amount, setAmount] = useState(debt ? String(debt.amount) : "");
    const [date, setDate] = useState(debt ? toDateInputValue(debt.date) : toDateInputValue());
    const [dueDate, setDueDate] = useState(debt?.dueDate ? toDateInputValue(debt.dueDate) : "");
    const [note, setNote] = useState(debt?.note ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");

            // API call: PUT /api/debts/[id] when editing, POST /api/debts when creating.
            // Empty due date is sent as null ("no due date").
            await apiFetch(debt ? `/api/debts/${debt.id}` : "/api/debts", {
                method: debt ? "PUT" : "POST",
                body: {
                    type,
                    personName,
                    amount: Number(amount),
                    date,
                    dueDate: dueDate || null,
                    note,
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
        <Modal title={debt ? "Edit Record" : type === "LENT" ? "Money I Lent" : "Money I Borrowed"} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Toggle between "I lent" and "I borrowed" (changes labels and colours below) */}
                <div className="grid grid-cols-2 gap-3">
                    {(["LENT", "BORROWED"] as DebtType[]).map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setType(value)}
                            aria-pressed={type === value}
                            className={`rounded-lg border px-4 py-2.5 font-medium transition ${
                                type === value
                                    ? value === "LENT"
                                        ? "border-emerald-400 bg-emerald-400/10 text-emerald-400"
                                        : "border-red-400 bg-red-400/10 text-red-400"
                                    : "border-slate-700 text-slate-400 hover:bg-slate-800"
                            }`}
                        >
                            {value === "LENT" ? "I lent" : "I borrowed"}
                        </button>
                    ))}
                </div>

                <div>
                    <label htmlFor="debt-person" className={labelClass}>
                        {type === "LENT" ? "Lent to" : "Borrowed from"}
                    </label>
                    <input
                        id="debt-person"
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                        placeholder="Name"
                        autoFocus
                        className={inputClass}
                    />
                </div>

                {/* Amount + date (date can't be in the future) */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="debt-amount" className={labelClass}>
                            Amount (₹)
                        </label>
                        <input
                            id="debt-amount"
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
                        <label htmlFor="debt-date" className={labelClass}>
                            Date
                        </label>
                        <input
                            id="debt-date"
                            type="date"
                            value={date}
                            max={toDateInputValue()}
                            onChange={(e) => setDate(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="debt-due" className={labelClass}>
                        Due date <span className="ml-1 text-xs text-slate-500">Optional</span>
                    </label>
                    <input
                        id="debt-due"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className={inputClass}
                    />
                </div>

                <div>
                    <label htmlFor="debt-note" className={labelClass}>
                        Note <span className="ml-1 text-xs text-slate-500">Optional</span>
                    </label>
                    <input
                        id="debt-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Example: Dinner split"
                        className={inputClass}
                    />
                </div>

                <FormError message={error} />

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className={secondaryButtonClass}>
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className={primaryButtonClass}>
                        {saving ? "Saving..." : debt ? "Save Changes" : "Save"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// Modal to record a partial (or full) repayment on one open debt.
function PaymentModal({
    debt,
    onClose,
    onSaved,
}: {
    debt: Debt;
    onClose: () => void;
    onSaved: () => void;
}) {
    // Amount still unpaid; also used as the input's max so you can't overpay.
    const remaining = debt.amount - debt.paidAmount;
    const [amount, setAmount] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");

            // API call: PATCH /api/debts/[id] with { payment }. The server adds it
            // to paidAmount (and marks the debt settled if it is now fully paid).
            await apiFetch(`/api/debts/${debt.id}`, {
                method: "PATCH",
                body: { payment: Number(amount) },
            });

            onSaved();
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            title="Record Payment"
            description={`${formatCurrency(remaining)} still ${
                debt.type === "LENT" ? `owed by ${debt.personName}` : `owed to ${debt.personName}`
            }.`}
            onClose={onClose}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="payment-amount" className={labelClass}>
                        Amount {debt.type === "LENT" ? "received" : "paid back"} (₹)
                    </label>
                    <input
                        id="payment-amount"
                        type="number"
                        min="0.01"
                        max={remaining}
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        autoFocus
                        required
                        className={inputClass}
                    />
                </div>

                <FormError message={error} />

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className={secondaryButtonClass}>
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className={primaryButtonClass}>
                        {saving ? "Saving..." : "Record"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
