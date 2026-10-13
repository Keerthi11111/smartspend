/**
 * FILE: app/api/accounts/route.ts
 * ROUTE: API: GET, POST /api/accounts
 *
 * WHAT IT DOES: GET returns all of the logged-in user's accounts (cash, bank,
 * card, wallet...) with a live balance, income/expense totals and transaction
 * count for each. POST creates a new account.
 * WHERE IT FITS: Called by app/dashboard/accounts/page.tsx (list + create),
 * app/dashboard/transactions/page.tsx, app/dashboard/recurring/page.tsx and
 * app/components/TransactionForm.tsx (to fill the "account" dropdown).
 * Uses getAuthenticatedUser (lib/get-auth-user.ts), jsonError (lib/api.ts),
 * parseAccountBody (lib/validation.ts), processDueRecurring (lib/recurring.ts)
 * and the Account, Expense and Transfer models.
 * WHY THIS CODE: Every request re-checks the login cookie and filters by userId,
 * so a user only ever sees their own accounts. The balance is NOT stored in the
 * database; it is calculated each time from the opening balance, transactions
 * and transfers, so it can never get out of sync. Due recurring bills are
 * posted first so balances include them. Bad input returns 400, success on
 * create returns 201, unexpected errors return 500.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { jsonError } from "@/lib/api";
import { parseAccountBody } from "@/lib/validation";
import { processDueRecurring } from "@/lib/recurring";

// GET /api/accounts → list of accounts, each with its calculated balance
export async function GET() {
    try {
        // Auth check: read the user from the "token" cookie. No user = 401.
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Auto-post any overdue recurring bills first, so the balances below
        // already include them (there is no cron job; we do it on read).
        await processDueRecurring(user.id);

        // Run four independent queries in parallel (faster than one by one):
        // 1. the user's accounts
        // 2. income/expense totals per account (groupBy = SQL GROUP BY)
        // 3. money sent OUT of each account via transfers
        // 4. money received INTO each account via transfers
        const [accounts, sums, outgoing, incoming] = await Promise.all([
            prisma.account.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: "asc" },
            }),
            prisma.expense.groupBy({
                by: ["accountId", "type"],
                // Skip transactions that are not linked to any account
                where: { userId: user.id, accountId: { not: null } },
                _sum: { amount: true },
                _count: true,
            }),
            prisma.transfer.groupBy({
                by: ["fromAccountId"],
                where: { userId: user.id },
                _sum: { amount: true },
            }),
            prisma.transfer.groupBy({
                by: ["toAccountId"],
                where: { userId: user.id },
                _sum: { amount: true },
            }),
        ]);

        // Small helper: find the grouped total row for one account + type
        const sumFor = (accountId: number, type: "INCOME" | "EXPENSE") =>
            sums.find((row) => row.accountId === accountId && row.type === type);

        // Combine the query results into one object per account
        const result = accounts.map((account) => {
            const income = sumFor(account.id, "INCOME");
            const expense = sumFor(account.id, "EXPENSE");
            // "?? 0" = use 0 when the account has no transfers at all
            const sentOut =
                outgoing.find((row) => row.fromAccountId === account.id)?._sum.amount ?? 0;
            const received =
                incoming.find((row) => row.toAccountId === account.id)?._sum.amount ?? 0;

            const totalIncome = income?._sum.amount ?? 0;
            const totalExpense = expense?._sum.amount ?? 0;

            return {
                ...account,
                income: totalIncome,
                expense: totalExpense,
                transactionCount: (income?._count ?? 0) + (expense?._count ?? 0),
                // Balance = starting money + income - expenses
                //           + transfers received - transfers sent
                balance:
                    account.openingBalance +
                    totalIncome -
                    totalExpense +
                    received -
                    sentOut,
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        // Any unexpected failure (e.g. DB down): log it on the server and
        // send a generic 500 so internal details are not leaked to the browser
        console.error("GET accounts error:", error);
        return jsonError("Failed to fetch accounts", 500);
    }
}

// POST /api/accounts → create a new account for the logged-in user
export async function POST(request: Request) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Validate the JSON body (name, type, openingBalance, color).
        // It returns either { data } or { error }.
        const parsed = parseAccountBody(await request.json());

        if (!parsed.data) {
            return jsonError(parsed.error, 400);
        }

        // Save it. userId comes from the cookie, never from the body,
        // so nobody can create an account for another user.
        const account = await prisma.account.create({
            data: { ...parsed.data, userId: user.id },
        });

        // 201 = "Created"
        return NextResponse.json(account, { status: 201 });
    } catch (error) {
        console.error("POST account error:", error);
        return jsonError("Failed to create account", 500);
    }
}
