"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: number;
  name: string;
}

export default function AddBudgetPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch("/api/categories");

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load categories");
        }

        const data: Category[] = await response.json();
        setCategories(data);
      } catch (error) {
        console.error(error);
        setError("Unable to load categories.");
      } finally {
        setCategoriesLoading(false);
      }
    }

    loadCategories();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!categoryId || !amount || Number(amount) <= 0) {
      setError("Please select a category and enter a valid amount.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId: Number(categoryId),
          amount: Number(amount),
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to save budget");
      }

      router.push("/dashboard/budgets");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold text-white">Add Budget</h1>

      <p className="mt-2 text-slate-400">
        Set a monthly spending limit for a category.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-6"
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Category
          </label>

          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            disabled={categoriesLoading}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
          >
            <option value="">
              {categoriesLoading ? "Loading categories..." : "Select category"}
            </option>

            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          {!categoriesLoading && categories.length === 0 && (
            <p className="mt-2 text-sm text-slate-400">
              No categories available. Add a category from the Add Transaction page first.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Monthly Budget Amount (₹)
          </label>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Example: 5000"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/budgets")}
            className="rounded-lg border border-slate-700 px-5 py-3 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading || categoriesLoading || categories.length === 0}
            className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Budget"}
          </button>
        </div>
      </form>
    </div>
  );
}