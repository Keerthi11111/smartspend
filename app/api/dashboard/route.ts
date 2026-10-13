/**
 * FILE: app/api/dashboard/route.ts
 * ROUTE: API: GET /api/dashboard
 *
 * WHAT IT DOES: GET builds everything the overview page needs in one response:
 * all-time totals and balance, this month vs last month, top spending
 * categories, budget alerts, recent transactions, upcoming bills, a
 * "safe to spend per day" figure, savings goals, open debts and short
 * plain-English insights.
 * WHERE IT FITS: Called by app/dashboard/page.tsx. Uses getAuthenticatedUser()
 * (lib/get-auth-user.ts), processDueRecurring() and advanceDate()
 * (lib/recurring.ts), formatCurrency() (lib/format.ts) and the Expense, Budget,
 * Category, Account, RecurringTransaction, SavingsGoal and Debt models.
 * WHY THIS CODE: One endpoint = one network request for the page instead of a
 * dozen. Independent queries run in parallel with Promise.all to keep it fast,
 * and totals are summed in the database (groupBy / aggregate) instead of
 * loading every row. Every query filters by userId so users only ever see
 * their own data. Due recurring bills are posted first so the numbers are
 * up to date.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { formatCurrency } from "@/lib/format";
import { advanceDate, processDueRecurring } from "@/lib/recurring";

// One day in milliseconds — used for date maths below.
const DAY = 24 * 60 * 60 * 1000;

// A short message shown on the dashboard; "tone" decides its colour (green / red / grey).
type Insight = { tone: "good" | "bad" | "neutral"; text: string };

// GET /api/dashboard — all overview numbers for the logged-in user.
export async function GET() {
    try {
        // Auth check: find the logged-in user from the "token" cookie.
        // Every API route does this, even though proxy.ts already guards the pages.
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Turn any recurring bills/income that are now due into real transactions
        // BEFORE we calculate, so the totals include them.
        await processDueRecurring(user.id);

        // Date boundaries. JavaScript months are 0-based (Jan = 0), so `month`
        // adds 1 to match how budgets store months (1-12).
        // new Date(year, monthIndex, 1) handles overflow, e.g. month -1 = last December.
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const startOfMonth = new Date(year, now.getMonth(), 1);
        const startOfNextMonth = new Date(year, now.getMonth() + 1, 1);
        const startOfPreviousMonth = new Date(year, now.getMonth() - 1, 1);

        // Same number of days into last month, for fair month-to-date comparisons
        const previousPeriodEnd = new Date(
            Math.min(
                startOfPreviousMonth.getTime() + (now.getTime() - startOfMonth.getTime()),
                startOfMonth.getTime()
            )
        );

        // Small helper: total amount grouped by type (INCOME / EXPENSE) for this user,
        // with extra filters (like a date range). The database does the adding up.
        const sumByType = (where: object) =>
            prisma.expense.groupBy({
                by: ["type"],
                where: { userId: user.id, ...where },
                _sum: { amount: true },
            });

        const [
            totals,
            currentMonth,
            previousMonth,
            categorySpend,
            budgets,
            recentTransactions,
            previousCategorySpend,
            largestExpense,
            openingBalances,
            recurring,
            goals,
            openDebts,
        ] = await Promise.all([
            // Run all these independent queries at the same time (in parallel)
            // instead of one after another — much faster. Results come back in
            // the same order as the names in the array above.
            // Every query filters by userId so we only ever read this user's data.

            // All-time income/expense totals.
            sumByType({}),
            // This month's totals. "gte" = on or after, "lt" = strictly before.
            sumByType({ date: { gte: startOfMonth, lt: startOfNextMonth } }),
            // Last month's totals (full month).
            sumByType({ date: { gte: startOfPreviousMonth, lt: startOfMonth } }),
            // This month's spending per category.
            prisma.expense.groupBy({
                by: ["categoryId"],
                where: {
                    userId: user.id,
                    type: "EXPENSE",
                    date: { gte: startOfMonth, lt: startOfNextMonth },
                },
                _sum: { amount: true },
            }),
            // This month's budgets (with category names) for the budget alerts.
            prisma.budget.findMany({
                where: { userId: user.id, month, year },
                include: { category: true },
            }),
            // The 5 most recent transactions.
            prisma.expense.findMany({
                where: { userId: user.id },
                include: { category: true },
                orderBy: { date: "desc" },
                take: 5,
            }),
            // Last month's spending per category, but only up to the same day
            // as today (previousPeriodEnd) — used by the insights for a fair comparison.
            prisma.expense.groupBy({
                by: ["categoryId"],
                where: {
                    userId: user.id,
                    type: "EXPENSE",
                    date: { gte: startOfPreviousMonth, lt: previousPeriodEnd },
                },
                _sum: { amount: true },
            }),
            // The single biggest expense this month (sorted by amount, take the first).
            prisma.expense.findFirst({
                where: {
                    userId: user.id,
                    type: "EXPENSE",
                    date: { gte: startOfMonth, lt: startOfNextMonth },
                },
                orderBy: { amount: "desc" },
            }),
            // Sum of all accounts' opening balances, plus how many accounts there are.
            prisma.account.aggregate({
                where: { userId: user.id },
                _sum: { openingBalance: true },
                _count: true,
            }),
            // Active recurring items, soonest due first (for "upcoming bills").
            prisma.recurringTransaction.findMany({
                where: { userId: user.id, active: true },
                include: { category: { select: { name: true } } },
                orderBy: { nextDate: "asc" },
            }),
            // Savings goals: nearest deadline first, goals with no deadline at the end.
            prisma.savingsGoal.findMany({
                where: { userId: user.id },
                orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
            }),
            // Debts that are not settled yet (settledAt is empty).
            prisma.debt.findMany({
                where: { userId: user.id, settledAt: null },
            }),
        ]);

        // groupBy returns rows like [{ type: "INCOME", _sum: { amount } }, ...].
        // pick() finds the row for one type and returns its sum, or 0 if there is none.
        const pick = (
            rows: { type: string; _sum: { amount: number | null } }[],
            type: "INCOME" | "EXPENSE"
        ) => rows.find((row) => row.type === type)?._sum.amount ?? 0;

        const totalIncome = pick(totals, "INCOME");
        const totalExpenses = pick(totals, "EXPENSE");
        const currentMonthIncome = pick(currentMonth, "INCOME");
        const currentMonthExpenses = pick(currentMonth, "EXPENSE");

        // categoryId -> amount spent this month. A Map gives fast lookups by id.
        const spentByCategory = new Map(
            categorySpend.map((row) => [row.categoryId, row._sum.amount ?? 0])
        );

        // groupBy only gives category ids, not names. Collect the unique ids from
        // this month and last month (Set removes duplicates), then load their names in one query.
        const categoryIds = [
            ...new Set(
                [...categorySpend, ...previousCategorySpend].map((row) => row.categoryId)
            ),
        ];
        const categories = await prisma.category.findMany({
            where: { id: { in: categoryIds } },
        });

        // Top 5 categories by spending this month (biggest first).
        const topCategories = categories
            .filter((category) => spentByCategory.has(category.id))
            .map((category) => ({
                category: category.name,
                amount: spentByCategory.get(category.id) ?? 0,
            }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        // Budget alerts: work out how much of each budget is used, and keep only
        // the ones at 80% or more (close to or over the limit), worst first.
        // The "amount > 0" check avoids dividing by zero.
        const budgetAlerts = budgets
            .map((budget) => {
                const spent = spentByCategory.get(budget.categoryId) ?? 0;

                return {
                    id: budget.id,
                    category: budget.category.name,
                    amount: budget.amount,
                    spent,
                    percentage:
                        budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
                };
            })
            .filter((budget) => budget.percentage >= 80)
            .sort((a, b) => b.percentage - a.percentage);

        // Upcoming bills: everything due within the next 7 days, including overdue
        const weekAhead = new Date(now.getTime() + 7 * DAY);
        const upcomingBills = recurring
            .filter((item) => item.nextDate <= weekAhead)
            .slice(0, 5)
            .map((item) => ({
                id: item.id,
                title: item.title,
                amount: item.amount,
                type: item.type,
                category: item.category.name,
                nextDate: item.nextDate,
                autoAdd: item.autoAdd,
                overdue: item.nextDate < now,
            }));

        // Expenses still due before month end (each occurrence, so weekly bills count every week)
        let billsDueThisMonth = 0;
        for (const item of recurring) {
            if (item.type !== "EXPENSE") continue;

            for (
                let date = item.nextDate;
                date < startOfNextMonth;
                date = advanceDate(date, item.frequency)
            ) {
                billsDueThisMonth += item.amount;
            }
        }

        // "Safe to spend": this month's income minus what's already spent and
        // the bills still to come, spread over the days left in the month.
        // daysLeft is at least 1 so we never divide by zero.
        const daysLeft = Math.max(
            1,
            Math.ceil((startOfNextMonth.getTime() - now.getTime()) / DAY)
        );
        const leftToSpend = currentMonthIncome - currentMonthExpenses - billsDueThisMonth;

        // Build the plain-English insight messages (see buildInsights below).
        const insights = buildInsights({
            currentTotal: currentMonthExpenses,
            previousTotal: previousCategorySpend.reduce(
                (sum, row) => sum + (row._sum.amount ?? 0),
                0
            ),
            categories: categories.map((category) => ({
                name: category.name,
                current: spentByCategory.get(category.id) ?? 0,
                previous:
                    previousCategorySpend.find((row) => row.categoryId === category.id)
                        ?._sum.amount ?? 0,
            })),
            largestExpense,
        });

        // Total still outstanding for one debt type: original amount minus what has been repaid.
        const sumDebts = (type: "LENT" | "BORROWED") =>
            openDebts
                .filter((debt) => debt.type === type)
                .reduce((sum, debt) => sum + debt.amount - debt.paidAmount, 0);

        // Send everything to the page in one JSON object.
        return NextResponse.json({
            totalIncome,
            totalExpenses,

            // Balance = money you started with in your accounts + all income - all expenses.
            balance:
                (openingBalances._sum.openingBalance ?? 0) + totalIncome - totalExpenses,
            accountCount: openingBalances._count,

            // Percentage of income you kept. 0 when there is no income (avoids dividing by zero).
            savingsRate:
                totalIncome > 0
                    ? ((totalIncome - totalExpenses) / totalIncome) * 100
                    : 0,

            monthlySummary: {
                income: currentMonthIncome,
                expenses: currentMonthExpenses,
                savings: currentMonthIncome - currentMonthExpenses,
            },

            previousMonthSummary: {
                income: pick(previousMonth, "INCOME"),
                expenses: pick(previousMonth, "EXPENSE"),
            },

            safeToSpend: {
                perDay: Math.max(leftToSpend, 0) / daysLeft,
                leftToSpend,
                billsDueThisMonth,
                daysLeft,
            },

            topCategories,
            budgetAlerts,
            recentTransactions,
            insights,
            upcomingBills,

            // Only unfinished goals, at most 3.
            goals: goals
                .filter((goal) => goal.savedAmount < goal.targetAmount)
                .slice(0, 3),

            debts: {
                owedToYou: sumDebts("LENT"),
                youOwe: sumDebts("BORROWED"),
            },
        });

    } catch (error) {
        // Unexpected error: log details on the server, send a generic 500 to the browser.
        console.error("Dashboard error:", error);

        return NextResponse.json(
            { error: "Failed to fetch dashboard data" },
            { status: 500 }
        );
    }
}

// Turns the raw numbers into short, friendly messages. Kept as a separate,
// pure function (no database calls) so it is easy to read and test.
function buildInsights({
    currentTotal,
    previousTotal,
    categories,
    largestExpense,
}: {
    currentTotal: number;
    previousTotal: number;
    categories: { name: string; current: number; previous: number }[];
    largestExpense: { title: string; amount: number } | null;
}) {
    const insights: Insight[] = [];

    // 1) Overall spending vs the same point last month. Only mention changes of 10% or more,
    //    so small, normal differences don't create noise.
    if (previousTotal > 0 && currentTotal > 0) {
        const change = ((currentTotal - previousTotal) / previousTotal) * 100;

        if (Math.abs(change) >= 10) {
            insights.push({
                tone: change > 0 ? "bad" : "good",
                text: `You've spent ${Math.abs(change).toFixed(0)}% ${
                    change > 0 ? "more" : "less"
                } than at this point last month.`,
            });
        }
    }

    // 2) Per-category change. Skip categories with no spending last month
    //    (a % change from 0 is meaningless / divide by zero).
    const changes = categories
        .filter((category) => category.previous > 0)
        .map((category) => ({
            ...category,
            diff: category.current - category.previous,
            change: ((category.current - category.previous) / category.previous) * 100,
        }));

    // The category that went up by at least 25%, choosing the biggest rise in money (diff).
    const biggestRise = changes
        .filter((category) => category.change >= 25)
        .sort((a, b) => b.diff - a.diff)[0];

    if (biggestRise) {
        insights.push({
            tone: "bad",
            text: `${biggestRise.name} spending is up ${biggestRise.change.toFixed(0)}% (${formatCurrency(
                biggestRise.diff
            )} more than this time last month).`,
        });
    }

    // The category that went down by at least 25%, choosing the biggest drop in money.
    const biggestDrop = changes
        .filter((category) => category.change <= -25)
        .sort((a, b) => a.diff - b.diff)[0];

    if (biggestDrop) {
        insights.push({
            tone: "good",
            text: `Nice! ${biggestDrop.name} spending is down ${Math.abs(
                biggestDrop.change
            ).toFixed(0)}% compared to this time last month.`,
        });
    }

    // 3) Always mention the biggest single expense this month, if there is one.
    if (largestExpense) {
        insights.push({
            tone: "neutral",
            text: `Biggest expense this month: ${largestExpense.title} (${formatCurrency(
                largestExpense.amount
            )}).`,
        });
    }

    return insights;
}
