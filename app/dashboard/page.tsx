"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
} from "lucide-react";

import StatCard from "../components/StatCard";

import { useEffect, useState } from "react";

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

interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savings: number;

  monthlySummary: {
    income: number;
    expenses: number;
    savings: number;
  };

  recentTransactions: Transaction[];
}

export default function DashboardPage() {
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch(
          "/api/dashboard"
        );

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          throw new Error(
            "Failed to fetch dashboard"
          );
        }

        const data =
          await response.json();

        setDashboard(data);
      } catch (error) {
        console.error(
          "Dashboard error:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-slate-400">
          Loading dashboard...
        </p>
      </div>
    );
  }

  const totalIncome =
    dashboard?.totalIncome ?? 0;

  const totalExpenses =
    dashboard?.totalExpenses ?? 0;

  const balance =
    dashboard?.balance ?? 0;

  const savings =
    dashboard?.savings ?? 0;

  const monthlyIncome =
    dashboard?.monthlySummary?.income ?? 0;

  const monthlyExpenses =
    dashboard?.monthlySummary?.expenses ?? 0;

  return (
    <div>
      {/* Header */}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Dashboard
        </h1>

        <p className="mt-2 text-slate-400">
          Here's an overview of your finances.
        </p>
      </div>

      {/* Statistics */}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">

        <StatCard
          title="Total Balance"
          value={`₹${balance.toLocaleString(
            "en-IN"
          )}`}
          description="Current balance"
          icon={Wallet}
        />

        <StatCard
          title="Income"
          value={`₹${totalIncome.toLocaleString(
            "en-IN"
          )}`}
          description="Total income"
          icon={ArrowUpRight}
        />

        <StatCard
          title="Expenses"
          value={`₹${totalExpenses.toLocaleString(
            "en-IN"
          )}`}
          description="Total expenses"
          icon={ArrowDownRight}
        />

        <StatCard
          title="Savings"
          value={`₹${savings.toLocaleString(
            "en-IN"
          )}`}
          description="Income minus expenses"
          icon={Wallet}
        />

      </div>

      {/* Bottom section */}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">

        {/* Recent Transactions */}

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Recent Transactions
            </h2>
          </div>

          <div className="mt-6 space-y-4">

            {dashboard?.recentTransactions?.length ? (
              dashboard.recentTransactions.map(
                (transaction) => (
                  <Transaction
                    key={transaction.id}
                    name={transaction.title}
                    category={
                      transaction.category?.name ||
                      "Uncategorized"
                    }
                    amount={transaction.amount}
                    type={transaction.type}
                    date={transaction.date}
                  />
                )
              )
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">
                No transactions yet.
              </p>
            )}

          </div>
        </div>

        {/* Monthly Summary */}

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">

          <h2 className="text-lg font-semibold text-white">
            Monthly Summary
          </h2>

          <div className="mt-8">

            <div className="mb-3 flex justify-between text-sm">

              <span className="text-slate-400">
                This month
              </span>

              <span className="text-white">
                ₹
                {monthlyExpenses.toLocaleString(
                  "en-IN"
                )}
                /
                ₹
                {monthlyIncome.toLocaleString(
                  "en-IN"
                )}
              </span>

            </div>

            {/* Progress */}

            <div className="h-3 overflow-hidden rounded-full bg-slate-800">

              <div
                className="h-full rounded-full bg-cyan-500 transition-all"
                style={{
                  width:
                    monthlyIncome > 0
                      ? `${Math.min(
                          (monthlyExpenses /
                            monthlyIncome) *
                            100,
                          100
                        )}%`
                      : "0%",
                }}
              />

            </div>

            <p className="mt-3 text-sm text-slate-500">

              {monthlyIncome -
                monthlyExpenses >=
              0
                ? `₹${(
                    monthlyIncome -
                    monthlyExpenses
                  ).toLocaleString(
                    "en-IN"
                  )} remaining this month.`
                : `₹${Math.abs(
                    monthlyIncome -
                      monthlyExpenses
                  ).toLocaleString(
                    "en-IN"
                  )} over your income.`}

            </p>

          </div>
        </div>

      </div>
    </div>
  );
}


/* --------------------------------
   Transaction Component
-------------------------------- */

function Transaction({
  name,
  category,
  amount,
  type,
  date,
}: {
  name: string;
  category: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  date: string;
}) {
  const isIncome = type === "INCOME";

  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-4">

      <div>

        <p className="font-medium text-white">
          {name}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          {category}
          {" • "}
          {new Date(date).toLocaleDateString(
            "en-IN",
            {
              day: "2-digit",
              month: "short",
            }
          )}
        </p>

      </div>

      <span
        className={
          isIncome
            ? "font-semibold text-emerald-400"
            : "font-semibold text-red-400"
        }
      >
        {isIncome ? "+" : "-"}₹
        {amount.toLocaleString("en-IN")}
      </span>

    </div>
  );
}