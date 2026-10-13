/**
 * FILE: app/dashboard/reports/page.tsx
 * ROUTE: /dashboard/reports
 *
 * WHAT IT DOES: Shows reports for the last 3, 6 or 12 months: four summary tiles
 * (income, expenses, average monthly spend, savings rate), a bar+line chart of
 * income vs expenses per month, and a donut chart + list of spending by category.
 * WHERE IT FITS: Reached from the "Reports" link in the Sidebar. Calls
 * GET /api/reports?months=<3|6|12>, which does all the adding-up on the server.
 * WHY THIS CODE: "use client" because it uses state, effects and recharts (charts
 * draw in the browser). Data loads in useEffect and re-loads whenever the range
 * changes; an AbortController drops an old request if the user switches range
 * quickly. While a new range loads, the old charts stay on screen (faded) instead
 * of flashing a "Loading" message. recharts is used because it gives ready-made
 * React chart components (see PROJECT_GUIDE.md tech stack).
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/format";

// Types matching the JSON returned by GET /api/reports.
// One row per month for the bar/line chart (savings = income - expense).
interface MonthlyReport {
  month: string;
  income: number;
  expense: number;
  savings: number;
}

// Total spent per category for the donut chart.
interface CategoryReport {
  category: string;
  amount: number;
}

// The full response: the range used, both chart datasets, and the summary numbers.
interface ReportsData {
  months: number;
  monthlyReport: MonthlyReport[];
  categoryReport: CategoryReport[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    averageMonthlyExpense: number;
    savingsRate: number;
  };
}

// Colours for the donut slices and matching legend dots (re-used in order
// if there are more categories than colours). Defined outside the component
// so they are created once, not on every render.
const COLORS = [
  "#06b6d4",
  "#8b5cf6",
  "#f59e0b",
  "#f43f5e",
  "#10b981",
  "#3b82f6",
];

// The range buttons offered at the top (in months).
const RANGES = [3, 6, 12];

// Dark-theme style shared by both chart tooltips.
const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "8px",
  color: "#ffffff",
};

// Compact axis labels: ₹12K, ₹1.2L
function compactCurrency(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(0)}K`;
  return `${sign}₹${abs}`;
}

export default function ReportsPage() {
  // months = selected range (default 6). reports = API data (null until first load).
  const [months, setMonths] = useState(6);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load the report whenever `months` changes (and on first render).
  // The cleanup aborts an in-flight request so an older, slower response
  // can't overwrite the newer one.
  useEffect(() => {
    const controller = new AbortController();

    async function loadReports() {
      try {
        setLoading(true);
        setError("");

        // API call: GET /api/reports for the selected range.
        const response = await fetch(`/api/reports?months=${months}`, {
          signal: controller.signal,
        });

        // Not logged in -> go to the login page.
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch reports");
        }

        setReports(await response.json());
      } catch (error) {
        // An aborted request is expected, not a real error.
        if (controller.signal.aborted) return;

        console.error("Reports error:", error);
        setError("Unable to load reports. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadReports();

    return () => controller.abort();
  }, [months]);

  // If loading failed, show only an error box with a "Try Again" button
  // (which simply reloads the whole page).
  if (error) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-red-400">{error}</p>

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

  // Derived values:
  // - hasMonthlyData: false when every month is zero, so we show a message
  //   instead of an empty chart
  // - categoryTotal: sum of all category spending, used for the % column
  // `?.` and `?? ...` handle the moment before `reports` has loaded.
  const hasMonthlyData =
    reports?.monthlyReport.some((m) => m.income > 0 || m.expense > 0) ?? false;
  const categoryTotal =
    reports?.categoryReport.reduce((sum, c) => sum + c.amount, 0) ?? 0;

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Reports
          </h1>

          <p className="mt-2 text-slate-400">
            Analyze your income and spending patterns.
          </p>
        </div>

        {/* Range picker (3M / 6M / 12M). Changing it re-runs the load effect. */}
        <div
          role="group"
          aria-label="Report range"
          className="flex rounded-lg border border-slate-700 p-1"
        >
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setMonths(range)}
              aria-pressed={months === range}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                months === range
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {range}M
            </button>
          ))}
        </div>
      </div>

      {/* First load: show "Loading...". Later reloads: keep old data visible but faded (opacity-60). */}
      {loading && !reports ? (
        <div className="py-10 text-center text-slate-400">
          Loading reports...
        </div>
      ) : reports && (
        <div className={loading ? "opacity-60 transition" : "transition"}>
          {/* Summary tiles */}
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryTile
              label="Income"
              value={formatCurrency(reports.summary.totalIncome)}
              tone="text-emerald-400"
            />
            <SummaryTile
              label="Expenses"
              value={formatCurrency(reports.summary.totalExpense)}
              tone="text-red-400"
            />
            <SummaryTile
              label="Avg. monthly spend"
              value={formatCurrency(Math.round(reports.summary.averageMonthlyExpense))}
            />
            <SummaryTile
              label="Savings rate"
              value={`${reports.summary.savingsRate.toFixed(0)}%`}
              tone={reports.summary.netSavings >= 0 ? "text-white" : "text-red-400"}
            />
          </div>

          {/* Monthly chart: ComposedChart lets us mix bars (income, expenses)
              with a line (net savings) on the same axes. ResponsiveContainer
              makes the chart fill its parent's width/height. */}
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-white">
              Monthly Income vs Expenses
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Last {reports.months} months, with net savings for each month.
            </p>

            <div className="mt-6 h-80">
              {!hasMonthlyData ? (
                <div className="flex h-full items-center justify-center text-slate-500">
                  No transactions in this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={reports.monthlyReport}
                    margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />

                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />

                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      width={60}
                      tickFormatter={(value) => compactCurrency(Number(value))}
                    />

                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "#1e293b" }}
                    />

                    <Legend />

                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="savings"
                      name="Net savings"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category breakdown: a donut chart (Pie with innerRadius) plus a
              list showing each category's colour, share (%) and amount. */}
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-white">
              Expenses by Category
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              See which categories account for your spending.
            </p>

            {reports.categoryReport.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-slate-500">
                No expenses in this period.
              </div>
            ) : (
              <div className="mt-6 grid items-center gap-6 lg:grid-cols-2">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reports.categoryReport}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={105}
                        innerRadius={60}
                        paddingAngle={2}
                      >
                        {reports.categoryReport.map((item, index) => (
                          <Cell
                            key={item.category}
                            fill={COLORS[index % COLORS.length]}
                            stroke="none"
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value ?? 0))}
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: "#ffffff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className="space-y-3">
                  {reports.categoryReport.map((item, index) => (
                    <li key={item.category} className="flex items-center gap-3 text-sm">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="flex-1 text-slate-300">{item.category}</span>
                      <span className="text-slate-500">
                        {categoryTotal > 0
                          ? `${((item.amount / categoryTotal) * 100).toFixed(0)}%`
                          : "0%"}
                      </span>
                      <span className="w-28 text-right font-medium text-white">
                        {formatCurrency(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Small reusable card for one summary number. `tone` is an optional Tailwind
// text-colour class (e.g. green for income, red for expenses).
function SummaryTile({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
