/**
 * FILE: app/dashboard/categories/page.tsx
 * ROUTE: /dashboard/categories
 *
 * WHAT IT DOES: Lists the categories used to label transactions, budgets and bills.
 *   "Your categories" are created by this user and can be edited or deleted;
 *   "Default categories" are shared by everyone and are read-only (lock icon).
 *   Each category shows how many transactions use it.
 *
 * WHERE IT FITS: Reached from the "Categories" link in the Sidebar. The categories made here
 *   appear in the dropdowns on the transaction, budget and recurring forms.
 *   API calls: GET/POST /api/categories, PUT/DELETE /api/categories/[id].
 *
 * WHY THIS CODE: "use client" because it uses state, effects and click handlers. Data is loaded
 *   in useEffect and reloaded by bumping "reloadKey" after every change. One
 *   modal handles both add and edit. The list markup is written once in
 *   renderList() and reused for both sections, with an "editable" flag. The
 *   server also refuses to change default categories, so the lock is not only
 *   a UI rule.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { Lock, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import Modal from "../../components/Modal";
import ColorPicker from "../../components/ColorPicker";
import FormError from "../../components/FormError";
import {
    apiFetch,
    errorMessage,
    inputClass,
    labelClass,
    primaryButtonClass,
    secondaryButtonClass,
} from "@/lib/client";

// One category as returned by GET /api/categories.
// isDefault = built-in category shared by all users; transactionCount is counted by the server.
interface Category {
    id: number;
    name: string;
    color: string;
    isDefault: boolean;
    transactionCount: number;
}

// Main page component.
export default function CategoriesPage() {
    // Data from the API plus loading/error flags.
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    // Changing reloadKey re-runs the loading useEffect below.
    const [reloadKey, setReloadKey] = useState(0);
    // Which modal is open: null = closed, "new" = add form, a Category = edit that category.
    const [editing, setEditing] = useState<Category | "new" | null>(null);

    // Load categories when the page opens and whenever reloadKey changes.
    // The AbortController cancels the request if the page unmounts or the effect re-runs.
    useEffect(() => {
        const controller = new AbortController();

        apiFetch<Category[]>("/api/categories", { signal: controller.signal })
            .then((data) => {
                setCategories(data);
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

    // Call after any change to fetch fresh data.
    const reload = () => setReloadKey((key) => key + 1);

    // Split the list into the user's own (editable) and the default (read-only) categories.
    const own = categories.filter((category) => !category.isDefault);
    const defaults = categories.filter((category) => category.isDefault);

    // Delete a category after confirming. If the API refuses (for example because the
    // category is still in use), its error message is shown in the banner.
    async function remove(category: Category) {
        if (!window.confirm(`Delete the "${category.name}" category?`)) return;

        try {
            await apiFetch(`/api/categories/${category.id}`, { method: "DELETE" });
            reload();
        } catch (error) {
            setError(errorMessage(error));
        }
    }

    // Renders a grid of category cards. Used for both sections;
    // "editable" decides whether to show Edit/Delete buttons or a lock icon.
    function renderList(list: Category[], editable: boolean) {
        return (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((category) => (
                    <li
                        key={category.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
                    >
                        {/* Color swatch, name and transaction count */}
                        <div className="flex min-w-0 items-center gap-3">
                            <span
                                className="h-9 w-9 shrink-0 rounded-lg"
                                style={{ backgroundColor: `${category.color}30`, border: `2px solid ${category.color}` }}
                                aria-hidden="true"
                            />
                            <div className="min-w-0">
                                <p className="truncate font-medium text-white">{category.name}</p>
                                <p className="text-xs text-slate-500">
                                    {category.transactionCount} transaction
                                    {category.transactionCount === 1 ? "" : "s"}
                                </p>
                            </div>
                        </div>

                        {/* Own categories get Edit/Delete buttons; default ones only get a lock icon */}
                        {editable ? (
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => setEditing(category)}
                                    aria-label={`Edit ${category.name}`}
                                    className="rounded-lg p-2 text-cyan-400 hover:bg-cyan-400/10"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => remove(category)}
                                    aria-label={`Delete ${category.name}`}
                                    className="rounded-lg p-2 text-red-400 hover:bg-red-400/10"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ) : (
                            <Lock size={14} className="shrink-0 text-slate-600" aria-label="Default category" />
                        )}
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div>
            {/* Page header with the Add Category button */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Categories</h1>
                    <p className="mt-2 text-slate-400">Organise your spending your way.</p>
                </div>

                <button type="button" onClick={() => setEditing("new")} className={primaryButtonClass}>
                    <Plus size={18} />
                    Add Category
                </button>
            </div>

            {/* Error banner */}
            {error && (
                <p className="mt-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
            )}

            {/* Loading text, then the two sections */}
            {loading ? (
                <p className="mt-8 text-slate-400">Loading categories...</p>
            ) : (
                <>
                    {/* Section 1: categories created by this user (or a friendly empty state) */}
                    <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">
                        Your categories
                    </h2>

                    {own.length === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
                            <Tags className="mx-auto text-slate-600" size={32} />
                            <p className="mt-3 text-sm text-slate-400">
                                Create your own categories like &quot;Pets&quot;, &quot;Gym&quot; or &quot;Kids&quot;.
                                Only you can see them.
                            </p>
                        </div>
                    ) : (
                        renderList(own, true)
                    )}

                    {/* Section 2: built-in default categories (read-only) */}
                    {defaults.length > 0 && (
                        <>
                            <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">
                                Default categories
                            </h2>
                            {renderList(defaults, false)}
                        </>
                    )}
                </>
            )}

            {/* Add/Edit modal, rendered only while open. On save: close it and reload. */}
            {editing && (
                <CategoryModal
                    category={editing === "new" ? null : editing}
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

// Form modal used for BOTH adding and editing a category (category = null means add).
function CategoryModal({
    category,
    onClose,
    onSaved,
}: {
    category: Category | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    // Form fields, pre-filled when editing. New categories start with cyan.
    const [name, setName] = useState(category?.name ?? "");
    const [color, setColor] = useState(category?.color ?? "#22d3ee");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Save the form. preventDefault stops the browser's default full-page submit.
    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");

            // Edit -> PUT /api/categories/[id], Add -> POST /api/categories.
            await apiFetch(category ? `/api/categories/${category.id}` : "/api/categories", {
                method: category ? "PUT" : "POST",
                body: { name, color },
            });

            onSaved();
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal title={category ? "Edit Category" : "Add Category"} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="category-name" className={labelClass}>
                        Name
                    </label>
                    <input
                        id="category-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Example: Pets"
                        autoFocus
                        className={inputClass}
                    />
                </div>

                {/* Shared color picker component (app/components/ColorPicker.tsx) */}
                <ColorPicker value={color} onChange={setColor} />

                {/* Shows the API error message, if any */}
                <FormError message={error} />

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className={secondaryButtonClass}>
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className={primaryButtonClass}>
                        {saving ? "Saving..." : category ? "Save Changes" : "Add Category"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
