/**
 * FILE: app/dashboard/calendar/page.tsx
 * ROUTE: /dashboard/calendar
 *
 * WHAT IT DOES: Shows one month as a calendar grid. Each day is shaded red by how much was
 *   spent that day, with small dots for income and for bills due. Clicking a
 *   day shows its transactions and due bills in a side panel. Cards at the top
 *   show the month's total, daily average, no-spend days and biggest day.
 *
 * WHERE IT FITS: Reached from the "Calendar" link in the Sidebar. The arrows switch months.
 *   API calls: GET /api/transactions?from=...&to=... (only the viewed month)
 *   and GET /api/recurring (to place upcoming bills on their due days).
 *
 * WHY THIS CODE: "use client" because it uses state, effects and click handlers. The effect
 *   depends on the month's from/to dates, so changing month automatically loads
 *   that month's data. Future bill dates are worked out in the browser with
 *   advanceDate() from lib/schedule.ts (the same helper the server uses), so no
 *   extra API is needed. All per-day numbers are derived from the loaded lists
 *   on each render instead of being stored in state.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { ArrowDownRight, ArrowUpRight, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { formatCurrency, formatDate, monthLabel, toDateInputValue } from "@/lib/format";
import { apiFetch, errorMessage } from "@/lib/client";
import { advanceDate, type Frequency } from "@/lib/schedule";

// One transaction from GET /api/transactions (only the fields this page uses).
interface Transaction {
    id: number;
    title: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    date: string;
    category: { name: string };
}

// One recurring bill/income from GET /api/recurring (only the fields this page uses).
interface RecurringItem {
    id: number;
    title: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    frequency: Frequency;
    nextDate: string;
    active: boolean;
}

// Everything shown for a single calendar day.
interface DayData {
    expense: number;
    income: number;
    transactions: Transaction[];
    bills: RecurringItem[];
}

// Column headings. The week starts on Monday.
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// "yyyy-mm-dd" as a local date (new Date(key) would parse it as UTC)
function fromKey(key: string) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

// A blank DayData, used for days that have no data.
function emptyDay(): DayData {
    return { expense: 0, income: 0, transactions: [], bills: [] };
}

// Main page component.
export default function CalendarPage() {
    // The month being viewed (month is 1-12). The function form of useState runs only once, on first render.
    const [period, setPeriod] = useState(() => {
        const now = new Date();
        return { month: now.getMonth() + 1, year: now.getFullYear() };
    });
    // Data loaded from the API for the viewed month.
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [recurring, setRecurring] = useState<RecurringItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    // The clicked day as "yyyy-mm-dd" (starts as today); its details show in the side panel.
    const [selected, setSelected] = useState(() => toDateInputValue());

    // Move to the previous (-1) or next (+1) month.
    // JavaScript's Date fixes overflow for us, e.g. month 13 becomes January of next year.
    function shiftMonth(delta: number) {
        setPeriod(({ month, year }) => {
            const date = new Date(year, month - 1 + delta, 1);
            return { month: date.getMonth() + 1, year: date.getFullYear() };
        });
    }

    // First day, number of days (day 0 of next month = last day of this month)
    // and the from/to date strings used in the API query.
    const firstDay = new Date(period.year, period.month - 1, 1);
    const daysInMonth = new Date(period.year, period.month, 0).getDate();
    const from = toDateInputValue(firstDay);
    const to = toDateInputValue(new Date(period.year, period.month - 1, daysInMonth));

    // Load the month's transactions and the recurring items.
    // Runs again whenever from/to change, i.e. when the user switches month.
    // The AbortController stops an old month's response from overwriting the new month.
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        async function loadMonth() {
            try {
                setLoading(true);

                const [transactionData, recurringData] = await Promise.all([
                    apiFetch<Transaction[]>(`/api/transactions?from=${from}&to=${to}`, { signal }),
                    apiFetch<RecurringItem[]>("/api/recurring", { signal }),
                ]);

                setTransactions(transactionData);
                setRecurring(recurringData);
                setError("");
            } catch (error) {
                if (!signal.aborted) setError(errorMessage(error));
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        }

        loadMonth();

        return () => controller.abort();
    }, [from, to]);

    // Build a Map from "yyyy-mm-dd" to that day's data.
    // It is wrapped in a function that runs immediately so the helper variables stay local.
    // It is rebuilt on each render, which is cheap for one month of data.
    const days = (() => {
        const map = new Map<string, DayData>();
        // Get the day's entry, creating an empty one the first time.
        const get = (key: string) => {
            if (!map.has(key)) map.set(key, emptyDay());
            return map.get(key)!;
        };

        // Add each transaction to its day and add up that day's income/expense.
        for (const transaction of transactions) {
            const day = get(toDateInputValue(transaction.date));
            day.transactions.push(transaction);
            if (transaction.type === "EXPENSE") day.expense += transaction.amount;
            else day.income += transaction.amount;
        }

        // Upcoming bills: every occurrence from the next due date through this month
        const monthEnd = new Date(period.year, period.month, 1);
        for (const item of recurring) {
            if (!item.active) continue;

            for (
                let date = new Date(item.nextDate);
                date < monthEnd;
                date = advanceDate(date, item.frequency)
            ) {
                const key = toDateInputValue(date);
                if (key >= from) get(key).bills.push(item);
            }
        }

        return map;
    })();

    // Today's date string, used to highlight today and count elapsed days.
    const today = toDateInputValue();
    // The biggest daily spend this month; each day's shade is its spend divided by this.
    const maxExpense = Math.max(0, ...Array.from(days.values(), (day) => day.expense));
    // Total spent in the viewed month.
    const totalExpense = transactions
        .filter((transaction) => transaction.type === "EXPENSE")
        .reduce((sum, transaction) => sum + transaction.amount, 0);

    // Count days that have already happened in the viewed month
    const elapsedDays =
        to < today ? daysInMonth : from > today ? 0 : new Date().getDate();

    // Walk through every day of the month to count no-spend days (only days already passed)
    // and find the day with the highest spending.
    let noSpendDays = 0;
    let biggestDay: { key: string; amount: number } | null = null;

    for (let day = 1; day <= daysInMonth; day++) {
        const key = toDateInputValue(new Date(period.year, period.month - 1, day));
        const expense = days.get(key)?.expense ?? 0;

        if (day <= elapsedDays && expense === 0) noSpendDays++;
        if (expense > 0 && (!biggestDay || expense > biggestDay.amount)) {
            biggestDay = { key, amount: expense };
        }
    }

    // Empty cells before day 1 so it lands under the right weekday.
    // getDay() returns 0 for Sunday; "+ 6) % 7" converts it to a Monday-first index.
    const leadingBlanks = (firstDay.getDay() + 6) % 7;
    // Data for the clicked day (or an empty day if nothing happened then).
    const selectedDay = days.get(selected) ?? emptyDay();

    return (
        <div>
            {/* Page header with previous / next month buttons */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Calendar</h1>
                    <p className="mt-2 text-slate-400">See your spending day by day.</p>
                </div>

                <div className="flex items-center rounded-lg border border-slate-700">
                    <button
                        type="button"
                        onClick={() => shiftMonth(-1)}
                        aria-label="Previous month"
                        className="p-2.5 text-slate-400 hover:text-white"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="min-w-36 text-center text-sm font-medium text-white">
                        {monthLabel(period.month, period.year)}
                    </span>
                    <button
                        type="button"
                        onClick={() => shiftMonth(1)}
                        aria-label="Next month"
                        className="p-2.5 text-slate-400 hover:text-white"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <p className="mt-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
            )}

            {/* Month summary cards */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Spent this month</p>
                    <p className="mt-1 text-xl font-bold text-white">{formatCurrency(totalExpense)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Daily average</p>
                    <p className="mt-1 text-xl font-bold text-white">
                        {formatCurrency(elapsedDays > 0 ? Math.round(totalExpense / elapsedDays) : 0)}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">No-spend days</p>
                    <p className="mt-1 text-xl font-bold text-emerald-400">
                        {noSpendDays}
                        <span className="ml-1 text-sm font-normal text-slate-500">of {elapsedDays}</span>
                    </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Biggest day</p>
                    <p className="mt-1 text-xl font-bold text-red-400">
                        {biggestDay ? formatCurrency(biggestDay.amount) : "—"}
                        {biggestDay && (
                            <span className="ml-1 text-sm font-normal text-slate-500">
                                {formatDate(fromKey(biggestDay.key), { day: "numeric", month: "short" })}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Two columns on wide screens: calendar grid (2/3) and day details (1/3) */}
            <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <div className={`rounded-xl border border-slate-800 bg-slate-900 p-3 sm:p-5 xl:col-span-2 ${loading ? "opacity-60" : ""}`}>
                    {/* 7-column grid: weekday headings, blank cells, then one button per day */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {weekdays.map((weekday) => (
                            <div key={weekday} className="pb-2 text-center text-xs font-medium text-slate-500">
                                {weekday}
                            </div>
                        ))}

                        {/* Blank cells before the 1st of the month */}
                        {Array.from({ length: leadingBlanks }).map((_, index) => (
                            <div key={`blank-${index}`} />
                        ))}

                        {/* One clickable cell per day of the month */}
                        {Array.from({ length: daysInMonth }).map((_, index) => {
                            const dayNumber = index + 1;
                            const key = toDateInputValue(
                                new Date(period.year, period.month - 1, dayNumber)
                            );
                            const day = days.get(key);
                            // How strong the red background is: 0 = no spending, 1 = the biggest day of the month.
                            const intensity =
                                day && maxExpense > 0 ? day.expense / maxExpense : 0;
                            const isSelected = key === selected;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setSelected(key)}
                                    aria-pressed={isSelected}
                                    aria-label={`${formatDate(fromKey(key))}${day?.expense ? `, spent ${formatCurrency(day.expense)}` : ""}`}
                                    className={`relative flex aspect-square flex-col rounded-lg border p-1 text-left transition sm:p-2 ${
                                        isSelected
                                            ? "border-cyan-400"
                                            : key === today
                                              ? "border-slate-500"
                                              : "border-slate-800 hover:border-slate-600"
                                    }`}
                                    style={{
                                        backgroundColor:
                                            intensity > 0
                                                ? `rgba(248, 113, 113, ${0.08 + intensity * 0.45})`
                                                : undefined,
                                    }}
                                >
                                    <span
                                        className={`text-xs font-medium sm:text-sm ${
                                            key === today ? "text-cyan-400" : "text-slate-300"
                                        }`}
                                    >
                                        {dayNumber}
                                    </span>

                                    {day && day.expense > 0 && (
                                        <span className="mt-auto hidden truncate text-[11px] font-medium text-white sm:block">
                                            {formatCurrency(Math.round(day.expense))}
                                        </span>
                                    )}

                                    {/* Small dots in the corner: green = income, amber = bill due */}
                                    <span className="absolute right-1 top-1 flex gap-0.5 sm:right-2 sm:top-2">
                                        {day && day.income > 0 && (
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                        )}
                                        {day && day.bills.length > 0 && (
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend explaining the colors */}
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded bg-red-400/50" /> Darker = more spent
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Income
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Bill due
                        </span>
                    </div>
                </div>

                {/* Details panel for the selected day */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                    <h2 className="text-lg font-semibold text-white">
                        {formatDate(fromKey(selected), { weekday: "long", day: "numeric", month: "long" })}
                    </h2>

                    {/* Day totals (only when there was money in or out) */}
                    {(selectedDay.expense > 0 || selectedDay.income > 0) && (
                        <p className="mt-1 text-sm text-slate-400">
                            {selectedDay.expense > 0 && (
                                <span className="text-red-400">-{formatCurrency(selectedDay.expense)}</span>
                            )}
                            {selectedDay.expense > 0 && selectedDay.income > 0 && " · "}
                            {selectedDay.income > 0 && (
                                <span className="text-emerald-400">+{formatCurrency(selectedDay.income)}</span>
                            )}
                        </p>
                    )}

                    {/* Bills due on this day (from the recurring items) */}
                    {selectedDay.bills.length > 0 && (
                        <div className="mt-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                                Due
                            </p>
                            <ul className="mt-2 space-y-2">
                                {selectedDay.bills.map((bill) => (
                                    <li key={bill.id} className="flex items-center justify-between gap-2 text-sm">
                                        <span className="flex items-center gap-2 text-slate-300">
                                            <CalendarClock size={16} className="text-amber-400" />
                                            {bill.title}
                                        </span>
                                        <span className="text-slate-300">{formatCurrency(bill.amount)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Transactions on this day */}
                    <div className="mt-5">
                        {selectedDay.transactions.length === 0 ? (
                            <p className="text-sm text-slate-500">No transactions on this day.</p>
                        ) : (
                            <ul className="space-y-3">
                                {selectedDay.transactions.map((transaction) => {
                                    const isIncome = transaction.type === "INCOME";

                                    return (
                                        <li key={transaction.id} className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`rounded-lg p-1.5 ${
                                                        isIncome
                                                            ? "bg-emerald-400/10 text-emerald-400"
                                                            : "bg-red-400/10 text-red-400"
                                                    }`}
                                                >
                                                    {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">{transaction.title}</p>
                                                    <p className="text-xs text-slate-500">{transaction.category.name}</p>
                                                </div>
                                            </div>
                                            <span
                                                className={`text-sm font-semibold ${
                                                    isIncome ? "text-emerald-400" : "text-red-400"
                                                }`}
                                            >
                                                {isIncome ? "+" : "-"}
                                                {formatCurrency(transaction.amount)}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
