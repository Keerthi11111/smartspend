/**
 * FILE: app/dashboard/budgets/page.tsx
 * ROUTE: /dashboard/budgets
 *
 * WHAT IT DOES: Shows every budget (a monthly spending limit per category) for
 * one chosen month, with how much has been spent and a coloured progress bar.
 * You can move between months, edit a budget's amount in a popup, or delete it.
 * WHERE IT FITS: Reached from the "Budget" link in the Sidebar. Calls
 * GET /api/budgets?month=&year= to load, PUT /api/budgets/[id] to edit and
 * DELETE /api/budgets/[id] to remove. The "Add Budget" button goes to
 * /dashboard/budgets/add (passing the current month/year in the URL).
 * WHY THIS CODE: "use client" because the page uses state, effects and click
 * handlers. Data is loaded in useEffect so it re-runs whenever the month changes
 * (or after an edit, via reloadKey). An AbortController cancels an old request
 * if the user switches month quickly, so stale data never overwrites new data.
 * Editing uses a small modal so the user stays on the same list.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Trash2, Plus, X } from "lucide-react";
import { formatCurrency, monthLabel } from "@/lib/format";
import { redirectToLogin } from "@/lib/redirect";

// Shape of one budget as returned by GET /api/budgets.
// spent / remaining / percentage are calculated by the API from the
// user's expenses in that category for the month.
interface Budget {
  id: number;
  amount: number;
  month: number;
  year: number;
  category: {
    id: number;
    name: string;
  };
  spent: number;
  remaining: number;
  percentage: number;
}

export default function BudgetsPage() {
  // router lets us navigate to the "Add Budget" page from code.
  const router = useRouter();

  // List data + loading / error flags for the main page.
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State for the edit modal and the delete button.
  // editingBudget is null when the modal is closed; when set, the modal opens.
  // deletingId remembers which card is being deleted so only its button is disabled.
  const [editingBudget, setEditingBudget] =
    useState<Budget | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // The month/year currently being viewed. Starts at today's month.
  // A function is passed to useState so `new Date()` only runs on the first render.
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  // Move the viewed month forward (+1) or back (-1).
  // Using a Date object handles year roll-over (Dec -> Jan) for us.
  function shiftMonth(delta: number) {
    setPeriod(({ month, year }) => {
      const date = new Date(year, month - 1 + delta, 1);
      return { month: date.getMonth() + 1, year: date.getFullYear() };
    });
  }

  // Bumping this number forces the load effect below to run again
  // (used after a successful edit to fetch fresh spent/remaining values).
  const [reloadKey, setReloadKey] = useState(0);

  // Load budgets for the selected month. Runs on first render and whenever
  // `period` or `reloadKey` changes. The cleanup function aborts the request
  // if the effect re-runs before it finishes (e.g. user clicks months fast).
  useEffect(() => {
    const controller = new AbortController();

    async function loadBudgets() {
      try {
        setLoading(true);
        setError("");

        // API call: GET /api/budgets for the chosen month/year.
        const response = await fetch(
          `/api/budgets?month=${period.month}&year=${period.year}`,
          { signal: controller.signal }
        );

        // 401 = not logged in (or session expired) -> send to the login page.
        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load budgets");
        }

        const data: Budget[] = await response.json();
        setBudgets(data);
      } catch (error) {
        // An aborted request is expected (not a real error), so ignore it.
        if (controller.signal.aborted) return;

        console.error("Load budgets error:", error);
        setError("Unable to load budgets. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadBudgets();

    return () => controller.abort();
  }, [period, reloadKey]);

  // Derived totals for the summary card at the top. They are recalculated
  // on every render from `budgets`, so they never get out of sync.
  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Open the edit modal for one budget and pre-fill the amount field.
  function openEditModal(budget: Budget) {
    setEditingBudget(budget);
    setEditAmount(String(budget.amount));
    setError("");
  }

  // Submit handler for the edit modal: validates the amount, sends
  // PUT /api/budgets/[id], then closes the modal and reloads the list.
  async function handleUpdateBudget(
    event: React.FormEvent<HTMLFormElement>
  ) {
    // Stop the browser from doing a full-page form submit.
    event.preventDefault();

    if (!editingBudget) return;

    const amount = Number(editAmount);

    // Check the amount in the browser first for instant feedback
    // (the API validates it again on the server).
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      // API call: PUT /api/budgets/[id] with the new amount.
      const response = await fetch(
        `/api/budgets/${editingBudget.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ amount }),
        }
      );

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update budget");
      }

      // Success: close the modal and trigger a reload so the
      // spent / remaining numbers come fresh from the server.
      setEditingBudget(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update budget."
      );
    } finally {
      setSaving(false);
    }
  }

  // Delete one budget after the user confirms in a browser dialog.
  async function handleDeleteBudget(budget: Budget) {
    const confirmed = window.confirm(
      `Delete the ${budget.category.name} budget of ₹${budget.amount.toLocaleString("en-IN")}?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(budget.id);
      setError("");

      // API call: DELETE /api/budgets/[id].
      const response = await fetch(
        `/api/budgets/${budget.id}`,
        {
          method: "DELETE",
        }
      );

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete budget");
      }

      // Remove the card locally instead of re-fetching the whole list.
      setBudgets((current) =>
        current.filter((item) => item.id !== budget.id)
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete budget."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Budgets
          </h1>

          <p className="mt-2 text-slate-400">
            Track your monthly spending limits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month switcher: changing the month re-runs the load effect */}
          <div className="flex items-center rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="p-2.5 text-slate-400 hover:text-white"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-36 text-center text-sm font-medium text-white">
              {monthLabel(period.month, period.year)}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="p-2.5 text-slate-400 hover:text-white"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Add Budget: passes the viewed month/year in the URL so the add page uses the same month */}
          <button
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/budgets/add?month=${period.month}&year=${period.year}`
              )
            }
            className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
          >
            <Plus size={18} />
            Add Budget
          </button>
        </div>
      </div>

      {/* Overall summary */}
      {!loading && budgets.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm text-slate-400">Total budgeted</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatCurrency(totalSpent)}
                <span className="text-base font-normal text-slate-500">
                  {" "}
                  of {formatCurrency(totalBudget)}
                </span>
              </p>
            </div>
            <p
              className={`text-sm ${
                totalSpent > totalBudget ? "text-red-400" : "text-slate-400"
              }`}
            >
              {totalSpent > totalBudget
                ? `${formatCurrency(totalSpent - totalBudget)} over`
                : `${formatCurrency(totalBudget - totalSpent)} left`}
            </p>
          </div>
          {/* Progress bar: cyan normally, amber at 80%+, red at 100%+. Width is capped at 100%. */}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full ${
                totalPercentage >= 100
                  ? "bg-red-500"
                  : totalPercentage >= 80
                    ? "bg-amber-500"
                    : "bg-cyan-500"
              }`}
              style={{ width: `${Math.min(totalPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message (hidden while the modal is open, because the modal shows its own error) */}
      {error && !editingBudget && (
        <p className="mt-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Budget cards */}
      {loading ? (
        <p className="mt-8 text-slate-400">
          Loading budgets...
        </p>
      ) : budgets.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-slate-300">
            No budgets set for {monthLabel(period.month, period.year)}.
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Add a budget to start tracking your spending.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {budgets.map((budget) => {
            // Clamp the bar width between 0% and 100% so it never overflows,
            // while the text below still shows the real percentage.
            const percentage = Math.min(
              Math.max(budget.percentage, 0),
              100
            );

            const overBudget = budget.remaining < 0;

            return (
              <div
                key={budget.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-6"
              >
                {/* Category and actions */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-white">
                      {budget.category.name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      ₹
                      {budget.spent.toLocaleString("en-IN")}{" "}
                      spent of ₹
                      {budget.amount.toLocaleString("en-IN")}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(budget)}
                      title="Edit budget"
                      aria-label={`Edit ${budget.category.name} budget`}
                      className="rounded-lg p-2 text-cyan-400 hover:bg-cyan-400/10"
                    >
                      <Pencil size={18} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteBudget(budget)}
                      disabled={deletingId === budget.id}
                      title="Delete budget"
                      aria-label={`Delete ${budget.category.name} budget`}
                      className="rounded-lg p-2 text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    Budget used
                  </span>

                  <span
                    className={
                      overBudget
                        ? "font-medium text-red-400"
                        : "text-slate-300"
                    }
                  >
                    {Math.round(budget.percentage)}%
                  </span>
                </div>

                <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      overBudget || budget.percentage >= 100
                        ? "bg-red-500"
                        : budget.percentage >= 80
                          ? "bg-amber-500"
                          : "bg-cyan-500"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <p
                  className={`mt-3 text-sm ${
                    overBudget
                      ? "text-red-400"
                      : "text-slate-400"
                  }`}
                >
                  ₹
                  {Math.abs(budget.remaining).toLocaleString(
                    "en-IN"
                  )}{" "}
                  {overBudget ? "over budget" : "remaining"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit budget modal: only rendered while editingBudget is set. It is a
          fixed overlay so it sits on top of the page without leaving it. */}
      {editingBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                Edit Budget
              </h2>

              <button
                type="button"
                onClick={() => {
                  setEditingBudget(null);
                  setError("");
                }}
                aria-label="Close edit budget dialog"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <p className="mt-2 text-sm text-slate-400">
              Category: {editingBudget.category.name}
            </p>

            <form
              onSubmit={handleUpdateBudget}
              className="mt-6 space-y-5"
            >
              <div>
                <label
                  htmlFor="edit-budget-amount"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Monthly budget amount (₹)
                </label>

                <input
                  id="edit-budget-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editAmount}
                  onChange={(event) =>
                    setEditAmount(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBudget(null);
                    setError("");
                  }}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-cyan-500 px-5 py-2 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}