"use client";

import {
  ArrowLeft,
  Plus,
  Save,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

interface Category {
  id: number;
  name: string;
}

export default function AddTransactionPage() {
  const router = useRouter();

  // -----------------------------
  // Transaction states
  // -----------------------------

  const [title, setTitle] = useState("");

  const [amount, setAmount] = useState("");

  const [type, setType] =
    useState<"EXPENSE" | "INCOME">("EXPENSE");

  const [categoryId, setCategoryId] = useState("");

  const [date, setDate] = useState("");

  const [description, setDescription] = useState("");

  // -----------------------------
  // Category states
  // -----------------------------

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [categoryLoading, setCategoryLoading] =
    useState(true);

  const [showCategoryModal, setShowCategoryModal] =
    useState(false);

  const [newCategory, setNewCategory] =
    useState("");

  const [categorySaving, setCategorySaving] =
    useState(false);

  const [categoryError, setCategoryError] =
    useState("");

  // -----------------------------
  // Transaction states
  // -----------------------------

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  // -----------------------------
  // Set today's date
  // -----------------------------

  useEffect(() => {
    const today =
      new Date()
        .toISOString()
        .split("T")[0];

    setDate(today);
  }, []);

  // -----------------------------
  // Fetch categories
  // -----------------------------

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      setCategoryLoading(true);

      const response = await fetch(
        "/api/categories"
      );

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Failed to fetch categories"
        );
      }

      const data =
        await response.json();

      setCategories(data);
    } catch (error) {
      console.error(
        "Category fetch error:",
        error
      );

      setError(
        "Unable to load categories."
      );
    } finally {
      setCategoryLoading(false);
    }
  }

  // -----------------------------
  // Add new category
  // -----------------------------

  async function handleAddCategory() {
    setCategoryError("");

    const categoryName =
      newCategory.trim();

    if (!categoryName) {
      setCategoryError(
        "Please enter a category name."
      );

      return;
    }

    try {
      setCategorySaving(true);

      const response = await fetch(
        "/api/categories",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name: categoryName,
          }),
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {
        window.location.href =
          "/login";

        return;
      }

      if (!response.ok) {
        setCategoryError(
          data.error ||
            "Failed to add category."
        );

        return;
      }

      // Add new category
      setCategories(
        (previous) =>
          [...previous, data].sort(
            (a, b) =>
              a.name.localeCompare(
                b.name
              )
          )
      );

      // Automatically select it
      setCategoryId(
        String(data.id)
      );

      // Close modal
      setNewCategory("");

      setShowCategoryModal(false);
    } catch (error) {
      console.error(
        "Add category error:",
        error
      );

      setCategoryError(
        "Something went wrong."
      );
    } finally {
      setCategorySaving(false);
    }
  }

  // -----------------------------
  // Submit transaction
  // -----------------------------

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError("");

    // Validation

    if (!title.trim()) {
      setError(
        "Please enter transaction title."
      );

      return;
    }

    if (
      !amount ||
      Number(amount) <= 0
    ) {
      setError(
        "Please enter a valid amount."
      );

      return;
    }

    if (!categoryId) {
      setError(
        "Please select a category."
      );

      return;
    }

    if (!date) {
      setError(
        "Please select a date."
      );

      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "/api/transactions",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            title: title.trim(),

            amount: Number(amount),

            type,

            categoryId:
              Number(categoryId),

            date,

            description:
              description.trim() ||
              null,
          }),
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {
        window.location.href =
          "/login";

        return;
      }

      if (!response.ok) {
        setError(
          data.error ||
            "Failed to create transaction."
        );

        return;
      }

      // Success
      router.push(
        "/dashboard/transactions"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Transaction error:",
        error
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // JSX
  // -----------------------------

  return (
    <div className="min-h-screen">

      {/* Header */}

      <div className="mb-8">

        <button
          type="button"
          onClick={() =>
            router.push(
              "/dashboard/transactions"
            )
          }
          className="mb-5 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />

          Back to Transactions
        </button>

        <h1 className="text-3xl font-bold text-white">
          Add Transaction
        </h1>

        <p className="mt-2 text-slate-400">
          Record your income or expense.
        </p>

      </div>

      {/* Form */}

      <div className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* Transaction Type */}

          <div>

            <label className="mb-3 block text-sm font-medium text-slate-300">
              Transaction Type
            </label>

            <div className="grid grid-cols-2 gap-3">

              <button
                type="button"
                onClick={() =>
                  setType("EXPENSE")
                }
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
                onClick={() =>
                  setType("INCOME")
                }
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

            <label className="mb-2 block text-sm font-medium text-slate-300">
              Transaction Title
            </label>

            <input
              type="text"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="Example: Grocery Shopping"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

          </div>

          {/* Amount + Category */}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* Amount */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Amount
              </label>

              <div className="relative">

                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  ₹
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) =>
                    setAmount(
                      e.target.value
                    )
                  }
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-9 pr-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
                />

              </div>

            </div>

            {/* Category */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Category
              </label>

              <select
                value={categoryId}
                onChange={(e) =>
                  setCategoryId(
                    e.target.value
                  )
                }
                disabled={
                  categoryLoading
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400 disabled:opacity-50"
              >

                <option value="">
                  {categoryLoading
                    ? "Loading categories..."
                    : "Select category"}
                </option>

                {categories.map(
                  (category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  )
                )}

              </select>

              {/* Add category */}

              <button
                type="button"
                onClick={() => {
                  setCategoryError("");
                  setNewCategory("");
                  setShowCategoryModal(
                    true
                  );
                }}
                className="mt-2 flex items-center gap-1 text-sm font-medium text-cyan-400 hover:text-cyan-300"
              >
                <Plus size={15} />

                Add New Category
              </button>

            </div>

          </div>

          {/* Date */}

          <div>

            <label className="mb-2 block text-sm font-medium text-slate-300">
              Date
            </label>

            <input
              type="date"
              value={date}
              onChange={(e) =>
                setDate(e.target.value)
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />

          </div>

          {/* Description */}

          <div>

            <label className="mb-2 block text-sm font-medium text-slate-300">
              Description

              <span className="ml-2 text-xs text-slate-500">
                Optional
              </span>
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
              placeholder="Add details about this transaction..."
              rows={4}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

          </div>

          {/* Error */}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Buttons */}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/transactions"
                )
              }
              className="rounded-lg border border-slate-700 px-5 py-3 font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >

              <Save size={18} />

              {loading
                ? "Saving..."
                : "Save Transaction"}

            </button>

          </div>

        </form>

      </div>

      {/* Add Category Modal */}

      {showCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">

          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">

            {/* Modal Header */}

            <div className="mb-6 flex items-start justify-between">

              <div>

                <h2 className="text-xl font-semibold text-white">
                  Add New Category
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  This category will be available to all users.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCategoryModal(
                    false
                  )
                }
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={20} />
              </button>

            </div>

            {/* Category Input */}

            <label className="mb-2 block text-sm font-medium text-slate-300">
              Category Name
            </label>

            <input
              type="text"
              value={newCategory}
              onChange={(e) =>
                setNewCategory(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              placeholder="Example: Gym"
              autoFocus
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

            {/* Category Error */}

            {categoryError && (
              <p className="mt-2 text-sm text-red-400">
                {categoryError}
              </p>
            )}

            {/* Modal Buttons */}

            <div className="mt-6 flex justify-end gap-3">

              <button
                type="button"
                onClick={() =>
                  setShowCategoryModal(
                    false
                  )
                }
                className="rounded-lg border border-slate-700 px-4 py-2.5 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  handleAddCategory
                }
                disabled={
                  categorySaving
                }
                className="flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >

                <Plus size={16} />

                {categorySaving
                  ? "Adding..."
                  : "Add Category"}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}