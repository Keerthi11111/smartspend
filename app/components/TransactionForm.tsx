/**
 * FILE: app/components/TransactionForm.tsx
 * ROUTE: n/a (component)
 *
 * WHAT IT DOES: The full form for creating OR editing an income/expense
 * transaction (type, title, amount, category, date, account, description).
 * It also has a small "Add New Category" pop-up so you can create a category
 * without leaving the form.
 * WHERE IT FITS: Used by /dashboard/transactions/add (no transactionId = add
 * mode) and /dashboard/transactions/[id]/edit (with transactionId = edit
 * mode). API calls: GET /api/categories, GET /api/accounts,
 * GET /api/transactions/[id] (edit only), POST /api/categories (new category),
 * POST /api/transactions (add) or PUT /api/transactions/[id] (edit).
 * WHY THIS CODE:
 * - One shared form for add and edit, so both pages always have the same
 *   fields and validation. `isEditing` switches the title, URL and method.
 * - "use client" because it uses state, effects, the router and form events.
 * - useEffect loads dropdown data (and the existing transaction when editing)
 *   once on mount, with Promise.all so the requests run in parallel.
 * - Simple checks run in the browser before sending, for quick feedback; the
 *   API validates again because the browser can't be trusted.
 * - Amount and IDs are kept as strings in state (that's what inputs give us)
 *   and converted to numbers only when sending to the API.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { ArrowLeft, Plus, Save, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toDateInputValue } from "@/lib/format";

// Minimal shapes we need for the dropdowns (only id + name)
interface Category {
  id: number;
  name: string;
}

interface Account {
  id: number;
  name: string;
}

// transactionId given = edit that transaction; missing = add a new one
interface TransactionFormProps {
  transactionId?: number;
}

// Shared Tailwind classes for every text input / select in this form
const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400";

export default function TransactionForm({
  transactionId,
}: TransactionFormProps) {
  const router = useRouter();
  // Add mode vs edit mode is decided only by whether an id was passed in
  const isEditing = transactionId !== undefined;

  // Form field values (one state per input, "controlled inputs").
  // The date starts as today, via a function so it is computed only once.
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(() => toDateInputValue());
  const [description, setDescription] = useState("");

  // Dropdown options loaded from the API, plus a flag to show "Loading..."
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // State for the "Add New Category" pop-up (kept separate from the main
  // form's error/saving so the two don't interfere)
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState("");

  // Main form submit status and error message ("" = no error)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load everything the form needs when it first appears:
  // categories + accounts for the dropdowns, and (edit mode only) the
  // transaction itself so we can pre-fill the fields.
  // Re-runs only if isEditing/transactionId change.
  useEffect(() => {
    async function load() {
      try {
        const requests = [fetch("/api/categories"), fetch("/api/accounts")];

        if (isEditing) {
          requests.push(fetch(`/api/transactions/${transactionId}`));
        }

        // Promise.all runs the requests at the same time (faster than one
        // after another). transactionResponse is undefined in add mode.
        const [categoriesResponse, accountsResponse, transactionResponse] =
          await Promise.all(requests);

        // Any 401 means the login expired, so go back to the login page
        if (
          categoriesResponse.status === 401 ||
          accountsResponse.status === 401 ||
          transactionResponse?.status === 401
        ) {
          window.location.href = "/login";
          return;
        }

        if (!categoriesResponse.ok) {
          throw new Error("Unable to load categories.");
        }

        setCategories(await categoriesResponse.json());

        // Accounts are optional; the form still works without them
        if (accountsResponse.ok) {
          const accountData: Account[] = await accountsResponse.json();
          setAccounts(accountData);

          // Convenience: if there is only one account, pre-select it for new transactions
          if (!isEditing && accountData.length === 1) {
            setAccountId(String(accountData[0].id));
          }
        }

        if (transactionResponse) {
          if (!transactionResponse.ok) {
            throw new Error("Transaction not found.");
          }

          const transaction = await transactionResponse.json();

          // Copy the saved values into the form fields (edit mode).
          // Numbers become strings because inputs/selects work with strings.
          setTitle(transaction.title);
          setAmount(String(transaction.amount));
          setType(transaction.type);
          setCategoryId(String(transaction.categoryId));
          setAccountId(transaction.accountId ? String(transaction.accountId) : "");
          setDate(toDateInputValue(transaction.date));
          setDescription(transaction.description ?? "");
        }
      } catch (error) {
        console.error("Transaction form load error:", error);
        setError(
          error instanceof Error ? error.message : "Something went wrong."
        );
      } finally {
        // Hide "Loading..." whether loading worked or failed
        setInitialLoading(false);
      }
    }

    load();
  }, [isEditing, transactionId]);

  // Handler for the "Add Category" pop-up.
  // API call: POST /api/categories with { name }. On success the new category
  // is added to the dropdown (kept alphabetical), selected, and the pop-up closes.
  async function handleAddCategory() {
    setCategoryError("");

    const categoryName = newCategory.trim();

    if (!categoryName) {
      setCategoryError("Please enter a category name.");
      return;
    }

    try {
      setCategorySaving(true);

      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName }),
      });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setCategoryError(data.error || "Failed to add category.");
        return;
      }

      // Functional update (previous => ...) so we always build on the latest list
      setCategories((previous) =>
        [...previous, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setCategoryId(String(data.id));
      setNewCategory("");
      setShowCategoryModal(false);
    } catch (error) {
      console.error("Add category error:", error);
      setCategoryError("Something went wrong.");
    } finally {
      setCategorySaving(false);
    }
  }

  // Handler for the main form submit.
  // preventDefault stops the browser's normal full-page form submit.
  // We validate first, then send POST (add) or PUT (edit).
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Quick browser-side checks (the API checks again on the server)
    if (!title.trim()) {
      setError("Please enter transaction title.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!categoryId) {
      setError("Please select a category.");
      return;
    }

    if (!date) {
      setError("Please select a date.");
      return;
    }

    try {
      setSaving(true);

      // API call: PUT /api/transactions/[id] when editing, POST /api/transactions when adding.
      // Strings from the inputs are converted to numbers; empty optional
      // fields are sent as null.
      const response = await fetch(
        isEditing
          ? `/api/transactions/${transactionId}`
          : "/api/transactions",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            amount: Number(amount),
            type,
            categoryId: Number(categoryId),
            accountId: accountId ? Number(accountId) : null,
            date,
            description: description.trim() || null,
          }),
        }
      );

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save transaction.");
        return;
      }

      // Success: go back to the list. refresh() makes Next.js drop cached
      // data so the list shows the new/updated transaction.
      router.push("/dashboard/transactions");
      router.refresh();
    } catch (error) {
      console.error("Transaction error:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Page heading with a back link; text changes for add vs edit */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => router.push("/dashboard/transactions")}
          className="mb-5 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back to Transactions
        </button>

        <h1 className="text-3xl font-bold text-white">
          {isEditing ? "Edit Transaction" : "Add Transaction"}
        </h1>

        <p className="mt-2 text-slate-400">
          {isEditing
            ? "Update the details of this transaction."
            : "Record your income or expense."}
        </p>
      </div>

      {/* Form card: shows "Loading..." until the initial data has arrived */}
      <div className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">
        {initialLoading ? (
          <p className="py-10 text-center text-slate-400">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Expense / Income toggle. These are type="button" so they don't submit the form. */}
            <div>
              <span className="mb-3 block text-sm font-medium text-slate-300">
                Transaction Type
              </span>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("EXPENSE")}
                  aria-pressed={type === "EXPENSE"}
                  className={`rounded-lg border px-4 py-3 font-medium transition ${
                    type === "EXPENSE"
                      ? "border-red-400 bg-red-400/10 text-red-400"
                      : "border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  Expense
                </button>

                <button
                  type="button"
                  onClick={() => setType("INCOME")}
                  aria-pressed={type === "INCOME"}
                  className={`rounded-lg border px-4 py-3 font-medium transition ${
                    type === "INCOME"
                      ? "border-emerald-400 bg-emerald-400/10 text-emerald-400"
                      : "border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  Income
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label
                htmlFor="transaction-title"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Transaction Title
              </label>

              <input
                id="transaction-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Example: Grocery Shopping"
                className={inputClass}
              />
            </div>

            {/* Amount + Category (side by side on wider screens) */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="transaction-amount"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Amount
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    ₹
                  </span>

                  <input
                    id="transaction-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="transaction-category"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Category
                </label>

                <select
                  id="transaction-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select category</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>

                {/* Opens the "Add New Category" pop-up with a clean input */}
                <button
                  type="button"
                  onClick={() => {
                    setCategoryError("");
                    setNewCategory("");
                    setShowCategoryModal(true);
                  }}
                  className="mt-2 flex items-center gap-1 text-sm font-medium text-cyan-400 hover:text-cyan-300"
                >
                  <Plus size={15} />
                  Add New Category
                </button>
              </div>
            </div>

            {/* Date (future dates blocked with max=today) + optional Account */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="transaction-date"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Date
                </label>

                <input
                  id="transaction-date"
                  type="date"
                  value={date}
                  max={toDateInputValue()}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="transaction-account"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  {type === "INCOME" ? "Received in" : "Paid from"}
                  <span className="ml-2 text-xs text-slate-500">Optional</span>
                </label>

                <select
                  id="transaction-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No account</option>

                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>

                {/* No accounts yet? Offer a link to create one */}
                {accounts.length === 0 && (
                  <Link
                    href="/dashboard/accounts"
                    className="mt-2 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300"
                  >
                    Set up accounts
                  </Link>
                )}
              </div>
            </div>

            {/* Optional description */}
            <div>
              <label
                htmlFor="transaction-description"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Description
                <span className="ml-2 text-xs text-slate-500">Optional</span>
              </label>

              <textarea
                id="transaction-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about this transaction..."
                rows={4}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Validation / API error message */}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Cancel / Save buttons. Save is disabled while saving to stop double submits. */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => router.push("/dashboard/transactions")}
                className="rounded-lg border border-slate-700 px-5 py-3 font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={18} />
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "Save Transaction"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* "Add New Category" pop-up. Clicking the dark backdrop closes it;
          stopPropagation on the inner box keeps clicks inside from closing it. */}
      {showCategoryModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowCategoryModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowCategoryModal(false);
            }}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2
                  id="category-modal-title"
                  className="text-xl font-semibold text-white"
                >
                  Add New Category
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Only you will see this category.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                aria-label="Close"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <label
              htmlFor="new-category"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Category Name
            </label>

            {/* Enter adds the category. preventDefault stops it from submitting the main form. */}
            <input
              id="new-category"
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              placeholder="Example: Gym"
              autoFocus
              className={inputClass}
            />

            {categoryError && (
              <p className="mt-2 text-sm text-red-400">{categoryError}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="rounded-lg border border-slate-700 px-4 py-2.5 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleAddCategory}
                disabled={categorySaving}
                className="flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} />
                {categorySaving ? "Adding..." : "Add Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
