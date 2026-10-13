/**
 * FILE: app/api/budgets/route.ts
 * ROUTE: API: GET, POST /api/budgets
 *
 * WHAT IT DOES: GET returns the user's budgets for one month (?month=&year=,
 * default: current month), each with how much was spent, what is remaining and
 * a usage percentage. POST creates a budget for a category + month, or updates
 * the amount if one already exists (upsert).
 * WHERE IT FITS: GET is called by app/dashboard/budgets/page.tsx; POST by
 * app/dashboard/budgets/add/page.tsx. Uses getAuthenticatedUser,
 * findUserCategory (lib/api.ts) and the Budget, Expense and Category models.
 * WHY THIS CODE: Every query filters by userId so users only see their own
 * budgets. "Spent" is calculated live from EXPENSE transactions in that month
 * (not stored), so it is always correct. The schema has a unique key on
 * (userId, categoryId, month, year), which lets POST use upsert: one budget per
 * category per month, no duplicates. Month/year are range-checked and fall
 * back to the current month if missing or invalid.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { findUserCategory } from "@/lib/api";

// GET /api/budgets?month=5&year=2026 → budgets with spent / remaining / %
export async function GET(request: Request) {
    try {
        // Auth check: no valid login cookie → 401
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Read ?month= and ?year= from the URL (safe defaults if missing)
        const { month, year } = parseMonthYear(new URL(request.url).searchParams);

        // Two independent queries run in parallel:
        // 1. this user's budgets for the month (with category name/color)
        // 2. total EXPENSE amount per category in that same month
        const [budgets, spending] = await Promise.all([
            prisma.budget.findMany({
                where: {
                    userId: user.id,
                    month,
                    year,
                },

                include: {
                    category: true
                },

                orderBy: {
                    category: {
                        name: "asc",
                    },
                },
            }),
            prisma.expense.groupBy({
                by: ["categoryId"],
                where: {
                    userId: user.id,
                    type: "EXPENSE",
                    // From the 1st of this month (inclusive) up to the 1st of
                    // next month (exclusive). JS months are 0-based, hence "- 1".
                    date: {
                        gte: new Date(year, month - 1, 1),
                        lt: new Date(year, month, 1),
                    },
                },
                _sum: {
                    amount: true,
                },
            }),
        ]);

        // Map of categoryId → amount spent, for quick lookup below
        const spentByCategory = new Map(
            spending.map((row) => [row.categoryId, row._sum.amount ?? 0])
        );

        // Add spent / remaining / percentage to each budget
        const result = budgets.map((budget) => {
            const spentAmount = spentByCategory.get(budget.categoryId) ?? 0;

            return {
                ...budget,
                spent: spentAmount,
                // Can go negative when the user overspends
                remaining: budget.amount - spentAmount,
                // Guard against dividing by zero
                percentage:
                    budget.amount > 0
                        ? (spentAmount / budget.amount) * 100
                        : 0,
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        // Unexpected error: log on server, generic message to the client
        console.error("GET budgets error:", error);
        return NextResponse.json(
            { error: "Failed to retrieve budgets" },
            { status: 500 }
        );
    }
}

// Helper (not a route): reads month (1-12) and year (2000-2100) from query
// params. Anything missing or out of range falls back to the current month/year.
function parseMonthYear(searchParams: URLSearchParams) {
    const now = new Date();
    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));

    return {
        month:
            Number.isInteger(month) && month >= 1 && month <= 12
                ? month
                : now.getMonth() + 1,
        year:
            Number.isInteger(year) && year >= 2000 && year <= 2100
                ? year
                : now.getFullYear(),
    };
}

// POST /api/budgets → create (or update) a budget for a category + month
export async function POST(request: Request) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();

        const amount = Number(body.amount);
        const categoryId = Number(body.categoryId);

        // Validation: amount must be a positive number
        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                { error: "Enter a valid budget amount" },
                { status: 400 }
            );
        }

        // Validation: categoryId must be a positive whole number
        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            return NextResponse.json(
                { error: "Invalid category" },
                { status: 400 }
            );
        }

        // The category must be a default one or one this user created
        if (!(await findUserCategory(user.id, categoryId))) {
            return NextResponse.json(
                { error: "Category not found" },
                { status: 404 }
            );
        }

        // Reuse the same month/year rules as GET by wrapping the body values
        // in URLSearchParams
        const { month, year } = parseMonthYear(
            new URLSearchParams({
                month: String(body.month ?? ""),
                year: String(body.year ?? ""),
            })
        );

        // Upsert = "update if it exists, otherwise create". It looks up the
        // budget by the unique (userId, categoryId, month, year) key, so a user
        // can never end up with two budgets for the same category and month.
        const budget = await prisma.budget.upsert({
            where: {
                userId_categoryId_month_year: {
                    userId: user.id,
                    categoryId,
                    month,
                    year,
                },
            },

            update: {
                amount,
            },

            create: {
                amount,
                categoryId,
                userId: user.id,
                month,
                year,
            },
        });

        return NextResponse.json(budget, {
            status: 201,
        });
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            { error: "Failed to save budget" },
            { status: 500 }
        );
    }
}