/**
 * FILE: app/dashboard/page.tsx
 * ROUTE: /dashboard
 *
 * WHAT IT DOES: The overview page, the first page you see after logging in.
 * It shows summary cards (balance, this month's income/expenses, safe to
 * spend per day), budget alerts, insights, recent transactions, this month's
 * progress, upcoming bills, savings goals, debts and top spending categories.
 * WHERE IT FITS: /login sends you here after a successful login; it is also
 * the "Dashboard" link at the top of the Sidebar. It makes ONE API call:
 * GET /api/dashboard, which returns all the numbers already calculated.
 * WHY THIS CODE:
 * - "use client" because it keeps the loaded data in useState and loads it
 *   in useEffect after the page appears in the browser.
 * - One combined API call (instead of one per widget) means one loading state
 *   and one round trip; the server does the heavy maths.
 * - Three render states: skeleton cards while loading, an error box with
 *   "Try Again", then the full dashboard.
 * - Small derived values (percent change vs last month, month name) are
 *   computed during render; they're cheap so no useMemo is needed.
 * - TransactionRow is a small helper component at the bottom to keep the
 *   main JSX shorter.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Lightbulb,
  Plus,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import StatCard from "../components/StatCard";
import { formatCurrency, formatDate } from "@/lib/format";

// One row in "Recent Transactions" (as returned inside /api/dashboard)
interface Transaction {
  id: number;
  title: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  date: string;
  category: {
    id: number;
    name: string;
  };
}

// The full JSON shape returned by GET /api/dashboard.
// Each block below feeds one section of the page.
interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  accountCount: number;
  savingsRate: number;

  monthlySummary: {
    income: number;
    expenses: number;
    savings: number;
  };

  previousMonthSummary: {
    income: number;
    expenses: number;
  };

  topCategories: { category: string; amount: number }[];

  budgetAlerts: {
    id: number;
    category: string;
    amount: number;
    spent: number;
    percentage: number;
  }[];

  recentTransactions: Transaction[];

  safeToSpend: {
    perDay: number;
    leftToSpend: number;
    billsDueThisMonth: number;
    daysLeft: number;
  };

  insights: { tone: "good" | "bad" | "neutral"; text: string }[];

  upcomingBills: {
    id: number;
    title: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    category: string;
    nextDate: string;
    autoAdd: boolean;
    overdue: boolean;
  }[];

  goals: {
    id: number;
    name: string;
    targetAmount: number;
    savedAmount: number;
    color: string;
  }[];

  debts: {
    owedToYou: number;
    youOwe: number;
  };
}

// Icon + colour for each insight "tone" sent by the API.
// A lookup object avoids a chain of if/else in the JSX.
const insightStyles = {
  good: { icon: TrendingDown, className: "text-emerald-400" },
  bad: { icon: TrendingUp, className: "text-red-400" },
  neutral: { icon: Lightbulb, className: "text-cyan-400" },
};

// Percent change vs last month, or null when there's nothing to compare to
function percentChange(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Turns a percent change into a short label like "▲ 12%" for a StatCard
function trendLabel(change: number | null) {
  if (change === null) return undefined;
  const arrow = change >= 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(change).toFixed(0)}%`;
}

export default function DashboardPage() {
  // Page state: the API data (null until loaded), a loading flag, and an error message
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load the dashboard once when the page opens (empty dependency list).
  // API call: GET /api/dashboard. A 401 means the login expired -> /login.
  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard");

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch dashboard");
        }

        setDashboard(await response.json());
      } catch (error) {
        console.error("Dashboard error:", error);
        setError("Unable to load your dashboard. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  // While loading: show 4 grey pulsing "skeleton" cards in place of the stats
  if (loading) {
    return (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900"
          />
        ))}
      </div>
    );
  }

  // If loading failed: show the error and a button that reloads the page
  if (error || !dashboard) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-red-400">{error || "Something went wrong."}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Below this point the data is loaded. Pull out the parts we use most.
  const { monthlySummary, previousMonthSummary, safeToSpend } = dashboard;

  // Derived values: change vs last month for the income/expense cards
  const incomeChange = percentChange(
    monthlySummary.income,
    previousMonthSummary.income
  );
  const expenseChange = percentChange(
    monthlySummary.expenses,
    previousMonthSummary.expenses
  );

  // Current month name (e.g. "October") for card titles, and the biggest
  // category amount, used to scale the "Top Spending" bars (largest = 100%).
  // The API returns topCategories sorted biggest first.
  const monthName = new Date().toLocaleDateString("en-IN", { month: "long" });
  const topCategoryMax = dashboard.topCategories[0]?.amount ?? 0;

  return (
    <div>
      {/* Page heading + "Add Transaction" shortcut */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-2 text-slate-400">
            Here&apos;s an overview of your finances.
          </p>
        </div>

        <Link
          href="/dashboard/transactions/add"
          className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          <Plus size={18} />
          Add Transaction
        </Link>
      </div>

      {/* Summary cards. A negative balance is shown as "-₹..." */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Balance"
          value={`${dashboard.balance < 0 ? "-" : ""}${formatCurrency(
            Math.abs(dashboard.balance)
          )}`}
          description={
            dashboard.accountCount > 0
              ? "Opening balances plus all income minus expenses"
              : "All-time income minus expenses"
          }
          icon={Wallet}
        />

        <StatCard
          title={`${monthName} Income`}
          value={formatCurrency(monthlySummary.income)}
          description="vs last month"
          icon={ArrowUpRight}
          trend={
            incomeChange === null
              ? undefined
              : { label: trendLabel(incomeChange)!, positive: incomeChange >= 0 }
          }
        />

        {/* For expenses, going DOWN is good news, so positive = change <= 0 */}
        <StatCard
          title={`${monthName} Expenses`}
          value={formatCurrency(monthlySummary.expenses)}
          description="vs last month"
          icon={ArrowDownRight}
          trend={
            expenseChange === null
              ? undefined
              : { label: trendLabel(expenseChange)!, positive: expenseChange <= 0 }
          }
        />

        {/* Safe to spend = money left this month (after upcoming bills) / days left.
            The API calculates it; here we only pick the right description text. */}
        <StatCard
          title="Safe to Spend Today"
          value={formatCurrency(Math.floor(safeToSpend.perDay))}
          description={
            monthlySummary.income === 0
              ? "Add this month's income to see this"
              : safeToSpend.leftToSpend < 0
                ? "You're over your income this month"
                : `${safeToSpend.daysLeft} days left${
                    safeToSpend.billsDueThisMonth > 0
                      ? `, after ${formatCurrency(safeToSpend.billsDueThisMonth)} in bills`
                      : ""
                  }`
          }
          icon={ShieldCheck}
        />
      </div>

      {/* Budget alerts: only shown when some budget is nearly used up or over */}
      {dashboard.budgetAlerts.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle size={18} />
            <h2 className="font-semibold">Budget alerts</h2>
          </div>

          <ul className="mt-3 space-y-2 text-sm">
            {dashboard.budgetAlerts.map((alert) => (
              <li key={alert.id} className="flex flex-wrap justify-between gap-2">
                <span className="text-slate-300">
                  {alert.category}
                  <span className="text-slate-500">
                    {" "}
                    · {formatCurrency(alert.spent)} of {formatCurrency(alert.amount)}
                  </span>
                </span>
                <span
                  className={
                    alert.percentage >= 100 ? "font-medium text-red-400" : "text-amber-400"
                  }
                >
                  {alert.percentage >= 100
                    ? `Over by ${formatCurrency(alert.spent - alert.amount)}`
                    : `${Math.round(alert.percentage)}% used`}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href="/dashboard/budgets"
            className="mt-3 inline-block text-sm text-cyan-400 hover:text-cyan-300"
          >
            Review budgets →
          </Link>
        </div>
      )}

      {/* Insights: short tips generated by the API (e.g. spending up vs last month) */}
      {dashboard.insights.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold text-white">Insights</h2>

          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {dashboard.insights.map((insight) => {
              const { icon: Icon, className } = insightStyles[insight.tone];

              return (
                <li key={insight.text} className="flex items-start gap-3 text-sm text-slate-300">
                  <Icon size={18} className={`mt-0.5 shrink-0 ${className}`} />
                  {insight.text}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Main grid: Recent Transactions takes 2 columns, the side widgets 1 column */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Recent Transactions
            </h2>

            <Link
              href="/dashboard/transactions"
              className="text-sm text-cyan-400 hover:text-cyan-300"
            >
              View all
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {dashboard.recentTransactions.length ? (
              dashboard.recentTransactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))
            ) : (
              <div className="py-6 text-center text-sm text-slate-500">
                <p>No transactions yet.</p>
                <Link
                  href="/dashboard/transactions/add"
                  className="mt-2 inline-block text-cyan-400 hover:text-cyan-300"
                >
                  Add your first transaction
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Monthly Summary */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-white">This Month</h2>

            <div className="mt-6">
              <div className="mb-3 flex justify-between text-sm">
                <span className="text-slate-400">Spent of income</span>
                <span className="text-white">
                  {formatCurrency(monthlySummary.expenses)} /{" "}
                  {formatCurrency(monthlySummary.income)}
                </span>
              </div>

              {/* Progress bar: expenses as a % of income, capped at 100%.
                  Turns red when spending is more than income. */}
              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    monthlySummary.savings < 0 ? "bg-red-500" : "bg-cyan-500"
                  }`}
                  style={{
                    width:
                      monthlySummary.income > 0
                        ? `${Math.min(
                            (monthlySummary.expenses / monthlySummary.income) * 100,
                            100
                          )}%`
                        : monthlySummary.expenses > 0
                          ? "100%"
                          : "0%",
                  }}
                />
              </div>

              <p className="mt-3 text-sm text-slate-500">
                {monthlySummary.savings >= 0
                  ? `${formatCurrency(monthlySummary.savings)} left this month.`
                  : `${formatCurrency(Math.abs(monthlySummary.savings))} over your income.`}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                All-time savings rate: {dashboard.savingsRate.toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Upcoming bills */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Upcoming Bills</h2>
              <Link
                href="/dashboard/recurring"
                className="text-sm text-cyan-400 hover:text-cyan-300"
              >
                Manage
              </Link>
            </div>

            {dashboard.upcomingBills.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Nothing due in the next 7 days.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {dashboard.upcomingBills.map((bill) => (
                  <li key={bill.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-3">
                      <CalendarClock
                        size={18}
                        className={bill.overdue ? "text-red-400" : "text-amber-400"}
                      />
                      <div>
                        <p className="text-slate-200">{bill.title}</p>
                        <p className={`text-xs ${bill.overdue ? "text-red-400" : "text-slate-500"}`}>
                          {bill.overdue ? "Overdue since " : "Due "}
                          {formatDate(bill.nextDate, { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                    </div>
                    <span className={bill.type === "INCOME" ? "text-emerald-400" : "text-white"}>
                      {bill.type === "INCOME" ? "+" : ""}
                      {formatCurrency(bill.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Savings goals */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Savings Goals</h2>
              <Link href="/dashboard/goals" className="text-sm text-cyan-400 hover:text-cyan-300">
                View all
              </Link>
            </div>

            {dashboard.goals.length === 0 ? (
              <Link
                href="/dashboard/goals"
                className="mt-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"
              >
                <Target size={16} />
                Set a goal to start saving towards something.
              </Link>
            ) : (
              <ul className="mt-4 space-y-4">
                {dashboard.goals.map((goal) => {
                  const percentage = (goal.savedAmount / goal.targetAmount) * 100;

                  return (
                    <li key={goal.id}>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">{goal.name}</span>
                        <span className="text-slate-400">
                          {formatCurrency(goal.savedAmount)} / {formatCurrency(goal.targetAmount)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: goal.color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Debts summary, only shown if there is any money owed either way */}
            {(dashboard.debts.owedToYou > 0 || dashboard.debts.youOwe > 0) && (
              <Link
                href="/dashboard/debts"
                className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 text-sm"
              >
                <span>
                  <span className="block text-xs text-slate-500">Others owe you</span>
                  <span className="text-emerald-400">{formatCurrency(dashboard.debts.owedToYou)}</span>
                </span>
                <span>
                  <span className="block text-xs text-slate-500">You owe</span>
                  <span className="text-red-400">{formatCurrency(dashboard.debts.youOwe)}</span>
                </span>
              </Link>
            )}
          </div>

          {/* Top categories */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-white">Top Spending</h2>

            {dashboard.topCategories.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No expenses recorded this month.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {dashboard.topCategories.map((item) => (
                  <li key={item.category}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">{item.category}</span>
                      <span className="text-white">{formatCurrency(item.amount)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-cyan-500"
                        style={{
                          width: `${topCategoryMax > 0 ? (item.amount / topCategoryMax) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Small helper component: one line in "Recent Transactions".
// Income is green with "+", expenses red with "-".
function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isIncome = transaction.type === "INCOME";

  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-4 last:border-0 last:pb-0">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-lg p-2 ${
            isIncome ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
          }`}
        >
          {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
        </div>

        <div>
          <p className="font-medium text-white">{transaction.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {transaction.category?.name || "Uncategorized"}
            {" • "}
            {formatDate(transaction.date, { day: "2-digit", month: "short" })}
          </p>
        </div>
      </div>

      <span
        className={
          isIncome ? "font-semibold text-emerald-400" : "font-semibold text-red-400"
        }
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(transaction.amount)}
      </span>
    </div>
  );
}
