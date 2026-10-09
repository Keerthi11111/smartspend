"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, X } from "lucide-react";

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
  const router = useRouter();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingBudget, setEditingBudget] =
    useState<Budget | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadBudgets() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/budgets");

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load budgets");
      }

      const data: Budget[] = await response.json();
      setBudgets(data);
    } catch (error) {
      console.error("Load budgets error:", error);
      setError("Unable to load budgets. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBudgets();
  }, []);

  function openEditModal(budget: Budget) {
    setEditingBudget(budget);
    setEditAmount(String(budget.amount));
    setError("");
  }

  async function handleUpdateBudget(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingBudget) return;

    const amount = Number(editAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    try {
      setSaving(true);
      setError("");

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

      setEditingBudget(null);
      await loadBudgets();
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

  async function handleDeleteBudget(budget: Budget) {
    const confirmed = window.confirm(
      `Delete the ${budget.category.name} budget of ₹${budget.amount.toLocaleString("en-IN")}?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(budget.id);
      setError("");

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

        <button
          type="button"
          onClick={() => router.push("/dashboard/budgets/add")}
          className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
        >
          <Plus size={18} />
          Add Budget
        </button>
      </div>

      {/* Error message */}
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
            No budgets found for this month.
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Add a budget to start tracking your spending.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {budgets.map((budget) => {
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
                      overBudget || budget.percentage >= 90
                        ? "bg-red-500"
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

      {/* Edit budget modal */}
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