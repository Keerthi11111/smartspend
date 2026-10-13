/**
 * FILE: app/api/reports/route.ts
 * ROUTE: API: GET /api/reports?months=3|6|12
 *
 * WHAT IT DOES: GET returns report data for the last N months (3, 6 or 12,
 * default 6): income/expense/savings per month, total spending per category,
 * and a summary (totals, net savings, average monthly expense, savings rate).
 * WHERE IT FITS: Called by app/dashboard/reports/page.tsx, which draws the
 * charts with recharts. Uses getAuthenticatedUser() (lib/get-auth-user.ts) and
 * the Expense + Category models via lib/prisma.ts.
 * WHY THIS CODE: The "months" query value is checked against a fixed list so
 * nobody can request a huge or invalid range. Every month in the range gets a
 * bucket (even with no data) so the chart has no gaps. Only the logged-in
 * user's transactions are loaded (userId filter).
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";

// The only ranges the page offers. Anything else falls back to 6 months.
const ALLOWED_RANGES = [3, 6, 12];

// GET /api/reports — monthly and category report data for the logged-in user.
export async function GET(request: Request) {
  try {
    // Auth check: no valid login cookie = 401 Unauthorized.
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Read ?months= from the URL and only accept 3, 6 or 12 (safe default: 6).
    const requestedMonths = Number(
      new URL(request.url).searchParams.get("months")
    );
    const months = ALLOWED_RANGES.includes(requestedMonths)
      ? requestedMonths
      : 6;

    const now = new Date();

    // First day of the oldest month in the range. Example: months = 6 in October
    // gives 1 May (the current month counts as one of the 6).
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - (months - 1),
      1
    );

    // Load this user's transactions from startDate onwards, with their category
    // (we need the category name for the category report).
    const transactions = await prisma.expense.findMany({
      where: {
        userId: user.id,

        date: {
          gte: startDate,
        },
      },

      include: {
        category: true,
      },
    });

    // One bucket per month in range, so empty months still show up
    const buckets = Array.from({ length: months }, (_, index) => {
      const date = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + index,
        1
      );

      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        month: date.toLocaleString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        income: 0,
        expense: 0,
      };
    });

    // Look up a month's bucket quickly by its "year-month" key.
    const bucketByKey = new Map(
      buckets.map((bucket) => [bucket.key, bucket])
    );

    // category name -> total spent (expenses only).
    const categoryData: Record<string, number> = {};

    // Walk through every transaction once: add it to its month's income or
    // expense, and add expenses to their category total.
    for (const transaction of transactions) {
      const bucket = bucketByKey.get(
        `${transaction.date.getFullYear()}-${transaction.date.getMonth()}`
      );

      if (transaction.type === "INCOME") {
        if (bucket) bucket.income += transaction.amount;
      } else {
        if (bucket) bucket.expense += transaction.amount;

        const category = transaction.category.name;
        categoryData[category] =
          (categoryData[category] || 0) + transaction.amount;
      }
    }

    // Final per-month rows for the chart (drop the internal "key", add savings).
    const monthlyReport = buckets.map(({ month, income, expense }) => ({
      month,
      income,
      expense,
      savings: income - expense,
    }));

    // Turn the { name: amount } object into a list, biggest spending first.
    const categoryReport = Object.entries(categoryData)
      .map(([category, amount]) => ({
        category,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Totals across the whole range, used for the summary cards.
    const totalIncome = monthlyReport.reduce((sum, m) => sum + m.income, 0);
    const totalExpense = monthlyReport.reduce((sum, m) => sum + m.expense, 0);

    return NextResponse.json({
      months,
      monthlyReport,
      categoryReport,
      summary: {
        totalIncome,
        totalExpense,
        netSavings: totalIncome - totalExpense,
        averageMonthlyExpense: totalExpense / months,
        // % of income saved; 0 when there is no income (avoids dividing by zero).
        savingsRate:
          totalIncome > 0
            ? ((totalIncome - totalExpense) / totalIncome) * 100
            : 0,
      },
    });
  } catch (error) {
    // Unexpected error: log details on the server, send a generic 500 to the browser.
    console.error("Reports error:", error);

    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
