/**
 * FILE: app/api/categories/[id]/route.ts
 * ROUTE: API: PUT, DELETE /api/categories/:id
 *
 * WHAT IT DOES: PUT renames a custom category and/or changes its color.
 * DELETE removes a custom category, but only if nothing uses it.
 * WHERE IT FITS: Both are called by app/dashboard/categories/page.tsx (the
 * edit dialog and the delete button). Uses getAuthenticatedUser(),
 * jsonError / parseColor / parseId / visibleCategories (lib/api.ts) and the
 * Category, Expense, Budget and RecurringTransaction models.
 * WHY THIS CODE: Only the user's OWN categories can be changed. Default
 * categories (userId = null) are shared by all users, so editing one would
 * affect everybody — those return 404 here. Renames are checked for
 * duplicates (409). Delete refuses with 409 while transactions, budgets or
 * recurring items still point at the category, so no data is left without a
 * category (and no database error is thrown).
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { jsonError, parseColor, parseId, visibleCategories } from "@/lib/api";

// The second argument Next.js passes to handlers in a [id] folder.
// In Next 16, params is a Promise, so it must be awaited.
type Props = {
    params: Promise<{ id: string }>;
};

// Only the user's own categories can be changed; defaults are shared
// Returns the category only if the id is valid AND userId matches.
// Defaults (userId null) and other users' categories both come back as null -> 404.
async function findOwnCategory(userId: number, id: string) {
    const categoryId = parseId(id);

    return categoryId
        ? prisma.category.findFirst({ where: { id: categoryId, userId } })
        : null;
}

// PUT /api/categories/:id — rename / recolor one of the user's own categories.
export async function PUT(request: Request, { params }: Props) {
    try {
        // Auth check: no valid login cookie = 401 Unauthorized.
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check: the category must exist and belong to this user.
        const category = await findOwnCategory(user.id, (await params).id);

        if (!category) {
            return jsonError("Category not found or cannot be edited", 404);
        }

        // Read the body; the new name must be non-empty text.
        const body = await request.json();
        const name = typeof body.name === "string" ? body.name.trim() : "";

        if (!name) {
            return jsonError("Category name is required", 400);
        }

        // Is there ANOTHER visible category (default or own) with the same name,
        // ignoring case? "id: not" skips this category itself, so saving it
        // with the same name (e.g. only changing the color) is allowed.
        const duplicate = await prisma.category.findFirst({
            where: {
                id: { not: category.id },
                name: { equals: name, mode: "insensitive" },
                ...visibleCategories(user.id),
            },
        });

        if (duplicate) {
            return jsonError("Category already exists", 409);
        }

        // Save. If the color sent is invalid or missing, keep the current color.
        const updated = await prisma.category.update({
            where: { id: category.id },
            data: { name, color: parseColor(body.color, category.color) },
        });

        return NextResponse.json(updated);
    } catch (error) {
        // Unexpected error: log on the server, generic 500 to the browser.
        console.error("PUT category error:", error);
        return jsonError("Failed to update category", 500);
    }
}

// DELETE /api/categories/:id — delete one of the user's own categories if it's unused.
export async function DELETE(_request: Request, { params }: Props) {
    try {
        // Auth check: no valid login cookie = 401 Unauthorized.
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check: defaults and other users' categories can't be deleted.
        const category = await findOwnCategory(user.id, (await params).id);

        if (!category) {
            return jsonError("Category not found or cannot be deleted", 404);
        }

        // Count everything that still points at this category, in parallel.
        // (A custom category is only visible to its owner, so these rows are the user's own.)
        const [expenses, budgets, recurring] = await Promise.all([
            prisma.expense.count({ where: { categoryId: category.id } }),
            prisma.budget.count({ where: { categoryId: category.id } }),
            prisma.recurringTransaction.count({ where: { categoryId: category.id } }),
        ]);

        // Still in use -> 409 Conflict with a helpful message, instead of
        // deleting and leaving records without a category.
        if (expenses + budgets + recurring > 0) {
            return jsonError(
                "This category is in use by transactions, budgets or recurring items. Move them to another category first.",
                409
            );
        }

        // Nothing uses it, so it's safe to delete.
        await prisma.category.delete({ where: { id: category.id } });

        return NextResponse.json({ message: "Category deleted" });
    } catch (error) {
        // Unexpected error: log on the server, generic 500 to the browser.
        console.error("DELETE category error:", error);
        return jsonError("Failed to delete category", 500);
    }
}
