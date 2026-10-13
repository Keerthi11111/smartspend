/**
 * FILE: app/dashboard/accounts/page.tsx
 * ROUTE: /dashboard/accounts
 *
 * WHAT IT DOES: Shows every money account the user has (bank, cash, credit card, UPI wallet)
 *   with its current balance, plus net worth / assets / liabilities totals.
 *   Lets the user add, edit and delete accounts, and move money between their
 *   own accounts with a "transfer" (which is not counted as income or spending).
 *
 * WHERE IT FITS: Reached from the "Accounts" link in the Sidebar. Each account card links to
 *   /dashboard/transactions?accountId=... to see that account's transactions.
 *   API calls: GET/POST /api/accounts, PUT/DELETE /api/accounts/[id],
 *   GET/POST /api/transfers, DELETE /api/transfers/[id].
 *
 * WHY THIS CODE: "use client" because the page uses state, effects and click handlers,
 *   which only run in the browser. Data is loaded in useEffect after the page
 *   mounts (the API needs the user's login cookie). After any change we bump
 *   a "reloadKey" so the same effect simply loads fresh data again, instead of
 *   patching local state by hand. Add/edit and transfer forms open in modals
 *   so the user never leaves the page. Balances are computed on the server.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import {
    ArrowRight,
    ArrowRightLeft,
    Banknote,
    CreditCard,
    Landmark,
    Pencil,
    Plus,
    Smartphone,
    Trash2,
    Wallet,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import Modal from "../../components/Modal";
import ColorPicker from "../../components/ColorPicker";
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

// The account kinds the database allows (must match the enum in prisma/schema.prisma).
type AccountType = "CASH" | "BANK" | "CARD" | "WALLET" | "OTHER";

// One account as returned by GET /api/accounts.
// balance, income, expense and transactionCount are calculated by the server, not stored.
interface Account {
    id: number;
    name: string;
    type: AccountType;
    openingBalance: number;
    color: string;
    balance: number;
    income: number;
    expense: number;
    transactionCount: number;
}

// One transfer as returned by GET /api/transfers (with the names of both accounts included).
interface Transfer {
    id: number;
    amount: number;
    note: string | null;
    date: string;
    fromAccount: { id: number; name: string };
    toAccount: { id: number; name: string };
}

// Label + icon for each account type, kept in one list so the dropdown and the cards stay in sync.
// "typeof Wallet" just means "any lucide icon component".
const accountTypes: { value: AccountType; label: string; icon: typeof Wallet }[] = [
    { value: "BANK", label: "Bank account", icon: Landmark },
    { value: "CASH", label: "Cash", icon: Banknote },
    { value: "CARD", label: "Credit card", icon: CreditCard },
    { value: "WALLET", label: "UPI / Wallet", icon: Smartphone },
    { value: "OTHER", label: "Other", icon: Wallet },
];

// Look up the label/icon for a type; falls back to "Other" (index 4) if the type is unknown.
function typeInfo(type: AccountType) {
    return accountTypes.find((item) => item.value === type) ?? accountTypes[4];
}

// Formats money with a minus sign in front for negative values (e.g. credit card dues: -₹5,000).
function signedCurrency(value: number) {
    return `${value < 0 ? "-" : ""}${formatCurrency(Math.abs(value))}`;
}

// Main page component (Next.js renders the default export of page.tsx for this URL).
export default function AccountsPage() {
    // Data loaded from the API, plus loading/error flags for the UI.
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    // Changing reloadKey re-runs the loading useEffect below (see reload()).
    const [reloadKey, setReloadKey] = useState(0);

    // Which modal is open. null = closed, "new" = Add Account form, an Account object = edit that account.
    // Using one state for both modes lets a single AccountModal handle add and edit.
    const [editing, setEditing] = useState<Account | "new" | null>(null);
    const [showTransfer, setShowTransfer] = useState(false);

    // Load accounts and transfers when the page opens and again whenever reloadKey changes.
    // Promise.all runs both requests at the same time instead of one after another.
    // The AbortController cancels the requests if the page unmounts or the effect re-runs,
    // so an old, slow response can never overwrite newer data.
    useEffect(() => {
        const controller = new AbortController();

        Promise.all([
            apiFetch<Account[]>("/api/accounts", { signal: controller.signal }),
            apiFetch<Transfer[]>("/api/transfers", { signal: controller.signal }),
        ])
            .then(([accountData, transferData]) => {
                setAccounts(accountData);
                setTransfers(transferData);
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

    // Call this after any create/update/delete to fetch fresh data from the server.
    const reload = () => setReloadKey((key) => key + 1);

    // Derived totals: calculated from "accounts" on every render, so they never get out of sync.
    // Net worth = all balances; assets = positive balances; liabilities = the negative part (debts, card dues).
    const netWorth = accounts.reduce((sum, account) => sum + account.balance, 0);
    const assets = accounts
        .filter((account) => account.balance > 0)
        .reduce((sum, account) => sum + account.balance, 0);
    const liabilities = netWorth - assets;

    // Delete an account after asking the user to confirm (the message explains what happens to its data).
    async function deleteAccount(account: Account) {
        const confirmed = window.confirm(
            `Delete "${account.name}"? Its ${account.transactionCount} transaction(s) will be kept without an account, and its transfers will be removed.`
        );

        if (!confirmed) return;

        try {
            await apiFetch(`/api/accounts/${account.id}`, { method: "DELETE" });
            reload();
        } catch (error) {
            setError(errorMessage(error));
        }
    }

    // Delete a single transfer; both account balances update automatically after reload.
    async function deleteTransfer(transfer: Transfer) {
        if (!window.confirm(`Delete this ${formatCurrency(transfer.amount)} transfer?`)) return;

        try {
            await apiFetch(`/api/transfers/${transfer.id}`, { method: "DELETE" });
            reload();
        } catch (error) {
            setError(errorMessage(error));
        }
    }

    return (
        <div>
            {/* Page header: title on the left, Transfer and Add Account buttons on the right */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Accounts</h1>
                    <p className="mt-2 text-slate-400">
                        Your bank accounts, cash, cards and wallets in one place.
                    </p>
                </div>

                <div className="flex gap-2">
                    {/* Transfer needs a "from" and a "to" account, so it is disabled until at least two exist */}
                    <button
                        type="button"
                        onClick={() => setShowTransfer(true)}
                        disabled={accounts.length < 2}
                        title={accounts.length < 2 ? "Add at least two accounts to transfer" : undefined}
                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <ArrowRightLeft size={18} />
                        Transfer
                    </button>

                    <button
                        type="button"
                        onClick={() => setEditing("new")}
                        className={primaryButtonClass}
                    >
                        <Plus size={18} />
                        Add Account
                    </button>
                </div>
            </div>

            {/* Error banner, shown only when something failed */}
            {error && (
                <p className="mt-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
            )}

            {/* Three possible views: loading skeleton, empty state (no accounts), or the real content */}
            {loading ? (
                <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-40 animate-pulse rounded-xl border border-slate-800 bg-slate-900"
                        />
                    ))}
                </div>
            ) : accounts.length === 0 ? (
                <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
                    <Landmark className="mx-auto text-slate-600" size={40} />
                    <p className="mt-4 text-slate-300">No accounts yet.</p>
                    <p className="mt-2 text-sm text-slate-500">
                        Add your bank account, cash or credit card to see where your money is.
                    </p>
                    <button
                        type="button"
                        onClick={() => setEditing("new")}
                        className={`${primaryButtonClass} mx-auto mt-6`}
                    >
                        <Plus size={18} />
                        Add your first account
                    </button>
                </div>
            ) : (
                <>
                    {/* Summary cards: net worth, assets, liabilities */}
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                            <p className="text-sm text-slate-400">Net worth</p>
                            <p
                                className={`mt-2 text-2xl font-bold ${
                                    netWorth < 0 ? "text-red-400" : "text-white"
                                }`}
                            >
                                {signedCurrency(netWorth)}
                            </p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                            <p className="text-sm text-slate-400">Assets</p>
                            <p className="mt-2 text-2xl font-bold text-emerald-400">
                                {formatCurrency(assets)}
                            </p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                            <p className="text-sm text-slate-400">Liabilities</p>
                            <p className="mt-2 text-2xl font-bold text-red-400">
                                {formatCurrency(Math.abs(liabilities))}
                            </p>
                        </div>
                    </div>

                    {/* One card per account */}
                    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {accounts.map((account) => {
                            // Rename "icon" to "Icon" (capital letter) so React treats it as a component we can render as <Icon />.
                            const { icon: Icon, label } = typeInfo(account.type);

                            return (
                                <div
                                    key={account.id}
                                    className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5"
                                >
                                    {/* Thin colored strip on top of the card, using the account's chosen color */}
                                    <div
                                        className="absolute inset-x-0 top-0 h-1"
                                        style={{ backgroundColor: account.color }}
                                    />

                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="rounded-lg p-2.5"
                                                style={{
                                                    backgroundColor: `${account.color}20`,
                                                    color: account.color,
                                                }}
                                            >
                                                <Icon size={20} />
                                            </div>
                                            <div>
                                                <h2 className="font-semibold text-white">
                                                    {account.name}
                                                </h2>
                                                <p className="text-xs text-slate-500">{label}</p>
                                            </div>
                                        </div>

                                        {/* Edit opens the modal with this account; Delete asks for confirmation first */}
                                        <div className="flex gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setEditing(account)}
                                                aria-label={`Edit ${account.name}`}
                                                className="rounded-lg p-2 text-cyan-400 hover:bg-cyan-400/10"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteAccount(account)}
                                                aria-label={`Delete ${account.name}`}
                                                className="rounded-lg p-2 text-red-400 hover:bg-red-400/10"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Current balance, shown in red when it is negative */}
                                    <p
                                        className={`mt-5 text-2xl font-bold ${
                                            account.balance < 0 ? "text-red-400" : "text-white"
                                        }`}
                                    >
                                        {signedCurrency(account.balance)}
                                    </p>

                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                        <span>
                                            In{" "}
                                            <span className="text-emerald-400">
                                                {formatCurrency(account.income)}
                                            </span>
                                        </span>
                                        <span>
                                            Out{" "}
                                            <span className="text-red-400">
                                                {formatCurrency(account.expense)}
                                            </span>
                                        </span>
                                        <span>Opening {signedCurrency(account.openingBalance)}</span>
                                    </div>

                                    {/* Link to the transactions page, pre-filtered to this account */}
                                    <Link
                                        href={`/dashboard/transactions?accountId=${account.id}`}
                                        className="mt-4 inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
                                    >
                                        {account.transactionCount} transaction
                                        {account.transactionCount === 1 ? "" : "s"}
                                        <ArrowRight size={14} />
                                    </Link>
                                </div>
                            );
                        })}
                    </div>

                    {/* Reminder that only transactions linked to an account affect its balance */}
                    <p className="mt-4 text-xs text-slate-500">
                        Transactions without an account aren&apos;t counted in account balances. Pick an
                        account when adding a transaction to keep these accurate.
                    </p>

                    {/* Recent transfers list (or a hint explaining what transfers are for) */}
                    <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
                        <h2 className="text-lg font-semibold text-white">Recent transfers</h2>

                        {transfers.length === 0 ? (
                            <p className="mt-4 text-sm text-slate-500">
                                Moving money between your own accounts (like ATM withdrawals or card
                                bill payments)? Record it as a transfer so it isn&apos;t counted as
                                spending.
                            </p>
                        ) : (
                            <ul className="mt-4 divide-y divide-slate-800">
                                {transfers.map((transfer) => (
                                    <li
                                        key={transfer.id}
                                        className="flex items-center justify-between gap-3 py-3"
                                    >
                                        <div>
                                            <p className="flex flex-wrap items-center gap-2 text-sm text-white">
                                                {transfer.fromAccount.name}
                                                <ArrowRight size={14} className="text-slate-500" />
                                                {transfer.toAccount.name}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {formatDate(transfer.date)}
                                                {transfer.note && ` · ${transfer.note}`}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white">
                                                {formatCurrency(transfer.amount)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => deleteTransfer(transfer)}
                                                aria-label="Delete transfer"
                                                className="rounded-lg p-2 text-red-400 hover:bg-red-400/10"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}

            {/* Modals are rendered only while open. On save we close the modal and reload the data. */}
            {editing && (
                <AccountModal
                    account={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        reload();
                    }}
                />
            )}

            {showTransfer && (
                <TransferModal
                    accounts={accounts}
                    onClose={() => setShowTransfer(false)}
                    onSaved={() => {
                        setShowTransfer(false);
                        reload();
                    }}
                />
            )}
        </div>
    );
}

// Form modal used for BOTH adding and editing an account.
// account = null means "add a new one"; otherwise the fields start with that account's values.
function AccountModal({
    account,
    onClose,
    onSaved,
}: {
    account: Account | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    // Form field state, pre-filled from the account when editing ("??" gives a default when adding).
    // The balance is kept as a string because <input> values are strings; we convert it on submit.
    const [name, setName] = useState(account?.name ?? "");
    const [type, setType] = useState<AccountType>(account?.type ?? "BANK");
    const [openingBalance, setOpeningBalance] = useState(
        account ? String(account.openingBalance) : ""
    );
    const [color, setColor] = useState(account?.color ?? "#22d3ee");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Save the form. preventDefault stops the browser's normal full-page form submit.
    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");

            // Edit -> PUT /api/accounts/[id], Add -> POST /api/accounts. An empty balance is sent as 0.
            await apiFetch(account ? `/api/accounts/${account.id}` : "/api/accounts", {
                method: account ? "PUT" : "POST",
                body: { name, type, openingBalance: Number(openingBalance || 0), color },
            });

            onSaved();
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal title={account ? "Edit Account" : "Add Account"} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="account-name" className={labelClass}>
                        Account name
                    </label>
                    <input
                        id="account-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Example: HDFC Savings"
                        autoFocus
                        className={inputClass}
                    />
                </div>

                <div>
                    <label htmlFor="account-type" className={labelClass}>
                        Type
                    </label>
                    <select
                        id="account-type"
                        value={type}
                        onChange={(e) => setType(e.target.value as AccountType)}
                        className={inputClass}
                    >
                        {accountTypes.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="account-opening" className={labelClass}>
                        Opening balance (₹)
                    </label>
                    <input
                        id="account-opening"
                        type="number"
                        step="0.01"
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(e.target.value)}
                        placeholder="0.00"
                        className={inputClass}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                        The balance before your first transaction here. Use a negative number for
                        credit card dues.
                    </p>
                </div>

                {/* Shared color picker component (app/components/ColorPicker.tsx) */}
                <ColorPicker value={color} onChange={setColor} />

                {/* Shows the error message from the API, if any */}
                <FormError message={error} />

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className={secondaryButtonClass}>
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className={primaryButtonClass}>
                        {saving ? "Saving..." : account ? "Save Changes" : "Add Account"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// Form modal for moving money from one of the user's accounts to another.
function TransferModal({
    accounts,
    onClose,
    onSaved,
}: {
    accounts: Account[];
    onClose: () => void;
    onSaved: () => void;
}) {
    // Form state. From/To default to the first two accounts so they start out different.
    // useState(() => ...) runs the function only once, to get today's date as "yyyy-mm-dd".
    const [fromAccountId, setFromAccountId] = useState(String(accounts[0]?.id ?? ""));
    const [toAccountId, setToAccountId] = useState(String(accounts[1]?.id ?? ""));
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(() => toDateInputValue());
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Save the transfer.
    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        // Quick check in the browser before calling the API (the server validates again).
        if (fromAccountId === toAccountId) {
            setError("Choose two different accounts.");
            return;
        }

        try {
            setSaving(true);
            setError("");

            // POST /api/transfers. Numbers from the form are strings, so convert them with Number().
            await apiFetch("/api/transfers", {
                method: "POST",
                body: {
                    fromAccountId: Number(fromAccountId),
                    toAccountId: Number(toAccountId),
                    amount: Number(amount),
                    date,
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
        <Modal
            title="Transfer Money"
            description="Move money between your own accounts. Transfers don't count as income or spending."
            onClose={onClose}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* From / To account pickers side by side */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="transfer-from" className={labelClass}>
                            From
                        </label>
                        <select
                            id="transfer-from"
                            value={fromAccountId}
                            onChange={(e) => setFromAccountId(e.target.value)}
                            className={inputClass}
                        >
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="transfer-to" className={labelClass}>
                            To
                        </label>
                        <select
                            id="transfer-to"
                            value={toAccountId}
                            onChange={(e) => setToAccountId(e.target.value)}
                            className={inputClass}
                        >
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Amount and date side by side */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="transfer-amount" className={labelClass}>
                            Amount (₹)
                        </label>
                        <input
                            id="transfer-amount"
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
                        <label htmlFor="transfer-date" className={labelClass}>
                            Date
                        </label>
                        <input
                            id="transfer-date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="transfer-note" className={labelClass}>
                        Note <span className="ml-1 text-xs text-slate-500">Optional</span>
                    </label>
                    <input
                        id="transfer-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Example: ATM withdrawal"
                        className={inputClass}
                    />
                </div>

                <FormError message={error} />

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className={secondaryButtonClass}>
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className={primaryButtonClass}>
                        {saving ? "Saving..." : "Transfer"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
