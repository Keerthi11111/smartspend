"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface MonthlyReport {
  month: string;
  income: number;
  expense: number;
}

interface CategoryReport {
  category: string;
  amount: number;
}

interface ReportsData {
  monthlyReport: MonthlyReport[];
  categoryReport: CategoryReport[];
}

const COLORS = [
  "#06b6d4",
  "#8b5cf6",
  "#f59e0b",
  "#f43f5e",
  "#10b981",
  "#3b82f6",
];

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportsData>({
    monthlyReport: [],
    categoryReport: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReports() {
      try {
        const response = await fetch("/api/reports");

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch reports");
        }

        const data: ReportsData = await response.json();

        setReports(data);
      } catch (error) {
        console.error("Reports error:", error);
        setError("Unable to load reports. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  if (loading) {
    return (
      <div className="py-10 text-center text-slate-400">
        Loading reports...
      </div>
    );
  }

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

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold text-white">
          Reports
        </h1>

        <p className="mt-2 text-slate-400">
          Analyze your income and spending patterns.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-white">
          Monthly Income vs Expenses
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Income and expenses over the last six months with recorded transactions.
        </p>

        <div className="mt-6 h-80">
          {reports.monthlyReport.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              No monthly transaction data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={reports.monthlyReport}
                margin={{
                  top: 10,
                  right: 10,
                  left: 10,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                />

                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                />

                <YAxis
                  stroke="#94a3b8"
                  tickFormatter={(value) =>
                    `₹${Number(value).toLocaleString("en-IN")}`
                  }
                />

                <Tooltip
                  formatter={(value) =>
                    `₹${Number(value ?? 0).toLocaleString("en-IN")}`
                  }
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#ffffff",
                  }}
                />

                <Legend />

                <Bar
                  dataKey="income"
                  name="Income"
                  fill="#06b6d4"
                  radius={[4, 4, 0, 0]}
                />

                <Bar
                  dataKey="expense"
                  name="Expenses"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-white">
          Expenses by Category
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          See which categories account for your spending.
        </p>

        <div className="mt-6 h-80">
          {reports.categoryReport.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              No category expense data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reports.categoryReport}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={105}
                  innerRadius={55}
                  paddingAngle={3}
                  label={({ name, percent }) =>
                    `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {reports.categoryReport.map((item, index) => (
                    <Cell
                      key={item.category}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value) =>
                    `₹${Number(value ?? 0).toLocaleString("en-IN")}`
                  }
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#ffffff",
                  }}
                />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}