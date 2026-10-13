/**
 * FILE: app/dashboard/goals/page.tsx
 * ROUTE: /dashboard/goals
 *
 * WHAT IT DOES: Lists your savings goals (e.g. "Emergency fund") as cards with a
 * progress bar, a total-saved summary and, if a deadline is set, how much to save
 * per month. You can create, edit and delete goals, and add or withdraw money.
 * WHERE IT FITS: Reached from the "Savings Goals" link in the Sidebar. Calls
 * GET /api/goals (list), POST /api/goals (create), PUT /api/goals/[id] (edit),
 * PATCH /api/goals/[id] (add/withdraw money) and DELETE /api/goals/[id].
 * WHY THIS CODE: "use client" because it uses state, effects and click handlers.
 * The list is loaded in useEffect and re-loaded by bumping `reloadKey` after any
 * change, so the server stays the single source of truth. Create/edit and
 * add/withdraw happen in modals (shared Modal component) so the user never
 * leaves the page. Each modal is its own small component with its own form state,
 * which resets automatically each time the modal is opened.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { CheckCircle2, Minus, Pencil, Plus, Target, Trash2 } from "lucide-react";
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

// Shape of one savings goal as returned by GET /api/goals.
// deadline is an ISO date string, or null when no target date was set.
interface Goal {
    id: number;
    name: string;
    targetAmount: number;
    savedAmount: number;
    deadline: string | null;
    color: string;
}

// Whole months left until the deadline (at least 1 while it's still ahead, 0 once passed)
function monthsUntil(deadline: string) {
    const now = new Date();
    const end = new Date(deadline);

    if (end < now) return 0;

    let months =
        (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());

    if (end.getDate() < now.getDate()) months -= 1;

    return Math.max(1, months);
}

// Builds the helper line under a goal's progress bar:
// - null if there is no deadline or the goal is already reached
// - "Deadline passed..." (overdue: true) if the date is in the past
// - otherwise "Save ₹X/month to reach it by ..." (remaining / months left, rounded up)
function deadlineText(goal: Goal) {
    if (!goal.deadline) return null;

    const remaining = goal.targetAmount - goal.savedAmount;
    const months = monthsUntil(goal.deadline);

    if (remaining <= 0) return null;

    if (months === 0) {
        return {
            overdue: true,
            text: `Deadline passed on ${formatDate(goal.deadline)}`,
        };
    }

    return {
        overdue: false,
        text: `Save ${formatCurrency(Math.ceil(remaining / months))}/month to reach it by ${formatDate(
            goal.deadline,
            { month: "short", year: "numeric" }
        )}`,
    };
}

export default function GoalsPage() {
    // List data, loading/error flags, and a counter used to trigger a reload.
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    // Which modal is open:
    // - editing: null = closed, "new" = create form, a Goal = edit that goal
    // - contributing: the goal + whether we are adding or withdrawing money
    const [editing, setEditing] = useState<Goal | "new" | null>(null);
    const [contributing, setContributing] = useState<{
        goal: Goal;
        mode: "add" | "withdraw";
    } | null>(null);

    // Load goals on first render and again whenever reloadKey changes.
    // apiFetch (lib/client.ts) handles JSON, errors and 401 -> login redirect.
    // The AbortController cancels the request if the page unmounts or reloads first.
    useEffect(() => {
        const controller = new AbortController();

        // API call: GET /api/goals.
        apiFetch<Goal[]>("/api/goals", { signal: controller.signal })
            .then((data) => {
                setGoals(data);
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

    // Call this after any change to fetch the latest list from the server.
    const reload = () => setReloadKey((key) => key + 1);

    // Derived numbers for the summary card, recomputed from `goals` each render.
    const totalSaved = goals.reduce((sum, goal) => sum + goal.savedAmount, 0);
    const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
    const completed = goals.filter((goal) => goal.savedAmount >= goal.targetAmount).length;

    // Delete a goal after a browser confirm dialog, then reload the list.
    async function deleteGoal(goal: Goal) {
        if (!window.confirm(`Delete the "${goal.name}" goal?`)) return;

        try {
            // API call: DELETE /api/goals/[id].
            await apiFetch(`/api/goals/${goal.id}`, { method: "DELETE" });
            reload();
        } catch (error) {
            setError(errorMessage(error));
        }
    }

    return (
        <div>
            {/* Page heading + "New Goal" button (opens the create modal) */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Savings Goals</h1>
                    <p className="mt-2 text-slate-400">
                        Save up for the things that matter to you.
                    </p>
                </div>

                <button type="button" onClick={() => setEditing("new")} className={primaryButtonClass}>
                    <Plus size={18} />
                    New Goal
                </button>
            </div>

            {/* Page-level error (load or delete failures) */}
            {error && (
                <p className="mt-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
            )}

            {/* Three states: loading skeleton cards, empty state, or the goal list */}
            {loading ? (
                <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-48 animate-pulse rounded-xl border border-slate-800 bg-slate-900"
                        />
                    ))}
                </div>
            ) : goals.length === 0 ? (
                <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
                    <Target className="mx-auto text-slate-600" size={40} />
                    <p className="mt-4 text-slate-300">No savings goals yet.</p>
                    <p className="mt-2 text-sm text-slate-500">
                        A new phone, a trip, an emergency fund... set a target and track your progress.
                    </p>
                    <button
                        type="button"
                        onClick={() => setEditing("new")}
                        className={`${primaryButtonClass} mx-auto mt-6`}
                    >
                        <Plus size={18} />
                        Create your first goal
                    </button>
                </div>
            ) : (
                <>
                    {/* Summary card: total saved across all goals + how many are reached */}
                    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                            <div>
                                <p className="text-sm text-slate-400">Total saved</p>
                                <p className="mt-1 text-2xl font-bold text-white">
                                    {formatCurrency(totalSaved)}
                                    <span className="text-base font-normal text-slate-500">
                                        {" "}
                                        of {formatCurrency(totalTarget)}
                                    </span>
                                </p>
                            </div>
                            <p className="text-sm text-slate-400">
                                {completed} of {goals.length} goal{goals.length === 1 ? "" : "s"} reached
                            </p>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                            <div
                                className="h-full rounded-full bg-cyan-500"
                                style={{
                                    width: `${totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0}%`,
                                }}
                            />
                        </div>
                    </div>

                    {/* One card per goal */}
                    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {goals.map((goal) => {
                            // Per-card values: progress %, whether the target is reached,
                            // and the deadline helper text.
                            const percentage =
                                goal.targetAmount > 0
                                    ? (goal.savedAmount / goal.targetAmount) * 100
                                    : 0;
                            const done = goal.savedAmount >= goal.targetAmount;
                            const deadline = deadlineText(goal);

                            return (
                                <div
                                    key={goal.id}
                                    className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-6"
                                >
                                    {/* Header: coloured icon (tick when done), name, target, edit/delete */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="rounded-lg p-2.5"
                                                style={{ backgroundColor: `${goal.color}20`, color: goal.color }}
                                            >
                                                {done ? <CheckCircle2 size={20} /> : <Target size={20} />}
                                            </div>
                                            <div>
                                                <h2 className="font-semibold text-white">{goal.name}</h2>
                                                <p className="text-xs text-slate-500">
                                                    Target {formatCurrency(goal.targetAmount)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setEditing(goal)}
                                                aria-label={`Edit ${goal.name}`}
                                                className="rounded-lg p-2 text-cyan-400 hover:bg-cyan-400/10"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteGoal(goal)}
                                                aria-label={`Delete ${goal.name}`}
                                                className="rounded-lg p-2 text-red-400 hover:bg-red-400/10"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Progress: amount saved, percent, and a bar in the goal's colour (capped at 100%) */}
                                    <div className="mt-5 flex items-end justify-between">
                                        <p className="text-xl font-bold text-white">
                                            {formatCurrency(goal.savedAmount)}
                                        </p>
                                        <p className="text-sm font-medium" style={{ color: goal.color }}>
                                            {Math.floor(percentage)}%
                                        </p>
                                    </div>

                                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${Math.min(percentage, 100)}%`,
                                                backgroundColor: goal.color,
                                            }}
                                        />
                                    </div>

                                    {/* Status line: "reached", deadline advice, or amount still to go */}
                                    <p
                                        className={`mt-3 flex-1 text-sm ${
                                            done
                                                ? "text-emerald-400"
                                                : deadline?.overdue
                                                  ? "text-amber-400"
                                                  : "text-slate-400"
                                        }`}
                                    >
                                        {done
                                            ? "Goal reached! 🎉"
                                            : deadline?.text ??
                                              `${formatCurrency(goal.targetAmount - goal.savedAmount)} to go`}
                                    </p>

                                    {/* Add / Withdraw buttons open the ContributeModal (Withdraw disabled when nothing saved) */}
                                    <div className="mt-5 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setContributing({ goal, mode: "add" })}
                                            className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                                        >
                                            <Plus size={16} />
                                            Add money
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setContributing({ goal, mode: "withdraw" })}
                                            disabled={goal.savedAmount <= 0}
                                            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <Minus size={16} />
                                            Withdraw
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Create/edit modal. On save: close it and reload the list. */}
            {editing && (
                <GoalModal
                    goal={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        reload();
                    }}
                />
            )}

            {/* Add/withdraw money modal. {...contributing} passes `goal` and `mode` as props. */}
            {contributing && (
                <ContributeModal
                    {...contributing}
                    onClose={() => setContributing(null)}
                    onSaved={() => {
                        setContributing(null);
                        reload();
                    }}
                />
            )}
        </div>
    );
}

// Modal used for both creating (goal = null) and editing (goal = existing goal).
// Form fields start with the goal's current values when editing.
function GoalModal({
    goal,
    onClose,
    onSaved,
}: {
    goal: Goal | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    // Form fields. "Already saved" is only asked when creating; after that,
    // money changes go through Add / Withdraw instead.
    const [name, setName] = useState(goal?.name ?? "");
    const [targetAmount, setTargetAmount] = useState(goal ? String(goal.targetAmount) : "");
    const [savedAmount, setSavedAmount] = useState("");
    const [deadline, setDeadline] = useState(goal?.deadline ? toDateInputValue(goal.deadline) : "");
    const [color, setColor] = useState(goal?.color ?? "#22d3ee");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Save the goal: PUT /api/goals/[id] when editing, POST /api/goals when creating.
    // Inputs are strings, so amounts are converted with Number(); an empty
    // deadline is sent as null ("no deadline").
    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");

            await apiFetch(goal ? `/api/goals/${goal.id}` : "/api/goals", {
                method: goal ? "PUT" : "POST",
                body: {
                    name,
                    targetAmount: Number(targetAmount),
                    savedAmount: Number(savedAmount || 0),
                    deadline: deadline || null,
                    color,
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
        <Modal title={goal ? "Edit Goal" : "New Savings Goal"} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="goal-name" className={labelClass}>
                        What are you saving for?
                    </label>
                    <input
                        id="goal-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Example: Emergency fund"
                        autoFocus
                        className={inputClass}
                    />
                </div>

                {/* Target amount, plus "Already saved" side by side only when creating */}
                <div className={goal ? "" : "grid grid-cols-2 gap-3"}>
                    <div>
                        <label htmlFor="goal-target" className={labelClass}>
                            Target (₹)
                        </label>
                        <input
                            id="goal-target"
                            type="number"
                            min="1"
                            step="0.01"
                            value={targetAmount}
                            onChange={(e) => setTargetAmount(e.target.value)}
                            required
                            className={inputClass}
                        />
                    </div>

                    {!goal && (
                        <div>
                            <label htmlFor="goal-saved" className={labelClass}>
                                Already saved (₹)
                            </label>
                            <input
                                id="goal-saved"
                                type="number"
                                min="0"
                                step="0.01"
                                value={savedAmount}
                                onChange={(e) => setSavedAmount(e.target.value)}
                                placeholder="0"
                                className={inputClass}
                            />
                        </div>
                    )}
                </div>

                {/* Optional deadline; min = today so past dates can't be picked */}
                <div>
                    <label htmlFor="goal-deadline" className={labelClass}>
                        Target date <span className="ml-1 text-xs text-slate-500">Optional</span>
                    </label>
                    <input
                        id="goal-deadline"
                        type="date"
                        value={deadline}
                        min={toDateInputValue()}
                        onChange={(e) => setDeadline(e.target.value)}
                        className={inputClass}
                    />
                </div>

                <ColorPicker value={color} onChange={setColor} />

                <FormError message={error} />

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className={secondaryButtonClass}>
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className={primaryButtonClass}>
                        {saving ? "Saving..." : goal ? "Save Changes" : "Create Goal"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// Modal to add money to, or withdraw money from, one goal.
function ContributeModal({
    goal,
    mode,
    onClose,
    onSaved,
}: {
    goal: Goal;
    mode: "add" | "withdraw";
    onClose: () => void;
    onSaved: () => void;
}) {
    const [amount, setAmount] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // How much is still needed to hit the target (never below 0).
    const remaining = Math.max(goal.targetAmount - goal.savedAmount, 0);

    // Validate the amount, then send it to the API.
    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        const value = Number(amount);

        // Browser-side check for instant feedback; the API checks again.
        if (!Number.isFinite(value) || value <= 0) {
            setError("Enter an amount greater than zero.");
            return;
        }

        try {
            setSaving(true);
            setError("");

            // API call: PATCH /api/goals/[id]. One endpoint handles both actions:
            // a positive amount adds money, a negative amount withdraws it.
            await apiFetch(`/api/goals/${goal.id}`, {
                method: "PATCH",
                body: { amount: mode === "add" ? value : -value },
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
            title={mode === "add" ? `Add to ${goal.name}` : `Withdraw from ${goal.name}`}
            description={
                mode === "add"
                    ? `${formatCurrency(remaining)} left to reach your target.`
                    : `${formatCurrency(goal.savedAmount)} saved so far.`
            }
            onClose={onClose}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="contribute-amount" className={labelClass}>
                        Amount (₹)
                    </label>
                    <input
                        id="contribute-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={mode === "withdraw" ? goal.savedAmount : undefined}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        autoFocus
                        className={inputClass}
                    />

                    {/* Shortcut: fill in exactly what's left to reach the target */}
                    {mode === "add" && remaining > 0 && (
                        <button
                            type="button"
                            onClick={() => setAmount(String(remaining))}
                            className="mt-2 text-sm text-cyan-400 hover:text-cyan-300"
                        >
                            Fill the remaining {formatCurrency(remaining)}
                        </button>
                    )}
                </div>

                <FormError message={error} />

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className={secondaryButtonClass}>
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className={primaryButtonClass}>
                        {saving ? "Saving..." : mode === "add" ? "Add Money" : "Withdraw"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
