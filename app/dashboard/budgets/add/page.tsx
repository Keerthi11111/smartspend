/**
 * FILE: app/dashboard/budgets/add/page.tsx
 * ROUTE: /dashboard/budgets/add?month=<1-12>&year=<yyyy>
 *
 * WHAT IT DOES: A form to set a monthly spending limit for one category.
 * If a budget already exists for that category and month, saving updates it.
 * WHERE IT FITS: Opened by the "Add Budget" button on /dashboard/budgets, which
 * passes the month/year being viewed in the URL. Calls GET /api/categories to
 * fill the dropdown and POST /api/budgets to save, then goes back to the list.
 * WHY THIS CODE: "use client" because it uses state, effects and form events.
 * useSearchParams() reads month/year from the URL; Next.js requires any
 * component using it to be wrapped in <Suspense>, so the page is split into a
 * small wrapper (AddBudgetPage) and the real form (AddBudgetForm).
 * Categories are loaded once in useEffect when the form first appears.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { monthLabel } from "@/lib/format";
import { redirectToLogin } from "@/lib/redirect";

// Only the fields the dropdown needs from GET /api/categories.
interface Category {
  id: number;
  name: string;
}

// The exported page is just a <Suspense> wrapper. Next.js needs this boundary
// because AddBudgetForm calls useSearchParams(), which reads the URL on the client.
export default function AddBudgetPage() {
  return (
    <Suspense>
      <AddBudgetForm />
    </Suspense>
  );
}

// The actual form component.
function AddBudgetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Month/year come from the URL (?month=&year=). If missing or invalid,
  // `|| ...` falls back to the current month.
  const now = new Date();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;
  const year = Number(searchParams.get("year")) || now.getFullYear();

  // Form fields (kept as strings, the way inputs give them) plus
  // loading flags: `loading` = saving, `categoriesLoading` = dropdown loading.
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState("");

  // Load the user's categories once, when the form first appears
  // (empty dependency array [] = run only on mount).
  useEffect(() => {
    async function loadCategories() {
      try {
        // API call: GET /api/categories.
        const response = await fetch("/api/categories");

        // Not logged in -> go to the login page.
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

  // Form submit: validate, POST to the API, then return to the budgets list.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Stop the browser's default full-page form submit.
    event.preventDefault();
    setError("");

    // Quick browser-side check; the API validates again on the server.
    if (!categoryId || !amount || Number(amount) <= 0) {
      setError("Please select a category and enter a valid amount.");
      return;
    }

    try {
      setLoading(true);

      // API call: POST /api/budgets. Inputs are strings, so convert to numbers.
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId: Number(categoryId),
          amount: Number(amount),
          month,
          year,
        }),
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save budget");
      }

      // Saved: go back to the list. refresh() makes sure Next.js does not
      // show a cached (old) version of the page.
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
        Set a spending limit for a category in {monthLabel(month, year)}.
        Saving an existing category updates its budget.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-6"
      >
        {/* Category dropdown (disabled until categories have loaded) */}
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

        {/* Amount input */}
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

        {/* Actions: Save is disabled while saving or when there are no categories to pick */}
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