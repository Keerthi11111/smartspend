/**
 * FILE: app/api/categories/route.ts
 * ROUTE: API: GET, POST /api/categories
 *
 * WHAT IT DOES: GET lists every category the user can use — the shared
 * default categories plus their own — sorted by name, each with an
 * isDefault flag and how many of the user's transactions use it.
 * POST creates a new custom category from { name, color? }.
 * WHERE IT FITS: GET is called by app/dashboard/categories/page.tsx,
 * app/dashboard/budgets/add/page.tsx, app/dashboard/recurring/page.tsx and
 * app/components/TransactionForm.tsx (category dropdowns). POST is called by
 * the categories page and by TransactionForm ("add new category" shortcut).
 * Uses getAuthenticatedUser(), jsonError / parseColor / visibleCategories
 * (lib/api.ts) and the Category + Expense models.
 * WHY THIS CODE: Default categories have userId = null and are shared by
 * everyone; custom ones have the owner's userId. visibleCategories() returns
 * exactly "defaults OR mine", so users never see each other's categories.
 * Duplicate names (ignoring case) are rejected with 409 so dropdowns stay
 * clear. Colors are checked to be a valid hex value.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { jsonError, parseColor, visibleCategories } from "@/lib/api";

// GET /api/categories — defaults + the user's own categories, with usage counts.
export async function GET() {
    try {
        // Auth check: no valid login cookie = 401 Unauthorized.
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Load "default OR mine" categories. _count adds how many expenses use
        // each category — but only counting THIS user's expenses, because
        // default categories are shared and other users' rows must not be counted.
        const categories = await prisma.category.findMany({
            where: visibleCategories(user.id),
            include: {
                _count: {
                    select: {
                        expenses: { where: { userId: user.id } },
                    },
                },
            },
            orderBy: {
                name: "asc"
            }
        });

        // Reshape each row for the page: remove the raw userId and _count,
        // and add friendly fields isDefault and transactionCount instead.
        return NextResponse.json(
            categories.map(({ _count, userId, ...category }) => ({
                ...category,
                isDefault: userId === null,
                transactionCount: _count.expenses,
            }))
        );
    } catch (error) {
        // Unexpected error: log on the server, generic 500 to the browser.
        console.error(error);
        return jsonError("Failed to fetch categories", 500);
    }
}

// POST /api/categories — create a custom category owned by the logged-in user.
export async function POST(request: Request) {
    try {
        // Auth check first — never create data for an unknown user.
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Read the body; the name must be non-empty text (spaces trimmed).
        const body = await request.json();

        const name = typeof body.name === "string" ? body.name.trim() : "";

        if (!name) {
            return jsonError("Category name is required", 400);
        }

        // Duplicate check among the categories this user can see (defaults +
        // own), ignoring case — so "Food" and "food" count as the same.
        const existingCategory = await prisma.category.findFirst({
            where: {
                name: { equals: name, mode: "insensitive" },
                ...visibleCategories(user.id),
            },
        });

        if (existingCategory) {
            return jsonError("Category already exists", 409);
        }

        // Save it with this user as owner. parseColor falls back to a default
        // color if the one sent isn't a valid "#rrggbb" value.
        const category = await prisma.category.create({
            data: {
                name,
                color: parseColor(body.color),
                userId: user.id,
            },
        });

        // 201 = "Created". Same shape as GET rows; a brand-new category has 0 transactions.
        return NextResponse.json(
            { ...category, isDefault: false, transactionCount: 0 },
            { status: 201 }
        );

    } catch (error) {
        // Unexpected error: log on the server, generic 500 to the browser.
        console.error(error);
        return jsonError("Failed to create category", 500);
    }
}
