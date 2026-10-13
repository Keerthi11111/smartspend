/**
 * FILE: app/api/transactions/route.ts
 * ROUTE: API: GET, POST /api/transactions
 *
 * WHAT IT DOES: GET lists the logged-in user's income and expense records,
 * newest first, with optional filters: ?search=, ?type=INCOME|EXPENSE,
 * ?accountId=, ?from=yyyy-mm-dd and ?to=yyyy-mm-dd. POST creates a new
 * transaction from { title, amount, type, description?, date?, categoryId,
 * accountId? }.
 * WHERE IT FITS: GET is called by app/dashboard/transactions/page.tsx (the
 * list with filters), app/dashboard/calendar/page.tsx (one month at a time)
 * and app/dashboard/settings/page.tsx (CSV export). POST is called by
 * app/components/TransactionForm.tsx (used on /dashboard/transactions/add).
 * Uses getAuthenticatedUser(), findUserCategory / parseId / resolveAccountId
 * (lib/api.ts), processDueRecurring() (lib/recurring.ts) and the Expense
 * model (which stores both income and expenses).
 * WHY THIS CODE: Every query is filtered by userId, and the category and
 * account in a new transaction are checked to belong to the user (or be a
 * shared default category), so nobody can attach data to someone else's
 * records. Due recurring items are posted before listing so the list is
 * current. 400 = bad input, 404 = category/account not found, 201 = created.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { findUserCategory, parseId, resolveAccountId } from "@/lib/api";
import { processDueRecurring } from "@/lib/recurring";

// GET /api/transactions — list (and optionally filter) the user's transactions.
export async function GET(request: Request) {
    try {
        // Auth check: no valid login cookie = 401 Unauthorized.
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        // Add any recurring bills/income that are now due, so they appear in the list.
        await processDueRecurring(user.id);

        // Read the filters from the query string. Invalid values are simply
        // ignored (turned into undefined), and Prisma skips "undefined" filters.
        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search") || "";
        const typeParam = searchParams.get("type");
        const type =
            typeParam === "INCOME" || typeParam === "EXPENSE"
                ? typeParam
                : undefined;
        const accountId = parseId(searchParams.get("accountId")) ?? undefined;

        // from/to are yyyy-mm-dd; "to" is inclusive of the whole day
        const from = parseDate(searchParams.get("from"));
        const toDate = parseDate(searchParams.get("to"));
        const to = toDate
            ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
            : null;

        // One query with all filters combined. userId is ALWAYS included so a
        // user only ever sees their own transactions.
        const transactions = await prisma.expense.findMany({
            where: {
                userId: user.id,
                type,
                accountId,
                date:
                    from || to
                        ? {
                              gte: from ?? undefined,
                              lt: to ?? undefined,
                          }
                        : undefined,

                // Search text matches title OR description OR category name,
                // ignoring upper/lower case ("insensitive").
                OR: search ? [
                    {
                        title: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                    {
                        description: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                    {
                        category: {
                            name: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                    },
                ]
                    : undefined
            },

            // Attach the category, and only the id + name of the account (all the page needs).
            include: {
                category: true,
                account: { select: { id: true, name: true } },
            },
            orderBy: {
                date: "desc",
            }
        });

        return NextResponse.json(transactions);

    } catch (error) {
        // Unexpected error: log on the server, generic 500 to the browser.
        console.error("GET transactions error:", error);

        return NextResponse.json(
            { error: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}

// Turn a date string into a Date, or null if it's missing or not a real date.
// (Local helper; lib/api.ts has a similar parseDate for other routes.)
function parseDate(value: string | null) {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

// POST /api/transactions — create a new income or expense record.
export async function POST(request: Request) {
    try {

        // Auth check first — never create data for an unknown user.
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Read the JSON body sent by TransactionForm.
        const body = await request.json();

        const { title, amount, type, description, date, categoryId } = body;

        // Validation: title must be non-empty text, and amount + category are required.
        if (typeof title !== "string" || !title.trim() || !amount || !categoryId) {
            return NextResponse.json(
                {
                    error: "Title, amount and category are required",
                },
                { status: 400 }
            );
        }

        // Amount must be a real number above zero (blocks "abc", Infinity, negatives).
        // Income vs expense is decided by "type", not by the sign of the amount.
        if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            return NextResponse.json(
                { error: "Amount must be greater than zero" },
                { status: 400 }
            );
        }

        // Make sure the category is one this user may use (a shared default or
        // their own). Stops someone from using another user's category id.
        const category = await findUserCategory(user.id, Number(categoryId));

        if (!category) {
            return NextResponse.json(
                { error: "Category not found" },
                { status: 404 }
            );
        }

        // Account is optional. resolveAccountId returns null for "no account",
        // the id if the account belongs to this user, or undefined if it's invalid / not theirs.
        const accountId = await resolveAccountId(user.id, body.accountId);

        if (accountId === undefined) {
            return NextResponse.json(
                { error: "Account not found" },
                { status: 404 }
            );
        }

        // No date sent = use right now. A date that can't be parsed = 400.
        const transactionDate = date ? parseDate(date) : new Date();

        if (!transactionDate) {
            return NextResponse.json(
                { error: "Invalid transaction date" },
                { status: 400 }
            );
        }

        // Save the transaction. Text is trimmed, type defaults to EXPENSE,
        // an empty description is stored as null, and userId comes from the
        // login cookie (never from the request body).
        const transaction = await prisma.expense.create({
            data: {
                title: title.trim(),
                amount: Number(amount),
                type: type === "INCOME" ? "INCOME" : "EXPENSE",
                description:
                    typeof description === "string" && description.trim()
                        ? description.trim()
                        : null,
                date: transactionDate,

                userId: user.id,
                categoryId: category.id,
                accountId,
            },

            include: {
                category: true
            }

        })

        // 201 = "Created".
        return NextResponse.json(transaction, {
            status: 201
        });
    } catch (error) {
        // Unexpected error: log on the server, generic 500 to the browser.
        console.error("POST transaction error:", error);

        return NextResponse.json(
            { error: "Failed to create transaction" },
            { status: 500 }
        );
    }
}