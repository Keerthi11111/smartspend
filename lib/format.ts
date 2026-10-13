/**
 * FILE: lib/format.ts
 * ROUTE: n/a (helper)
 *
 * WHAT IT DOES: Turns raw numbers and dates into display text: currency (₹),
 * readable dates, month names, and the "yyyy-mm-dd" value that date inputs need.
 * WHERE IT FITS: Imported by dashboard pages and components (Dashboard, Transactions,
 * Budgets, Reports, Calendar, StatCard, TransactionForm, ...). It has no imports
 * and no server code, so it works in both the browser and on the server.
 * WHY THIS CODE: Keeping formatting in one place makes every page show money and
 * dates the same way. The "en-IN" locale gives Indian grouping (₹1,00,000).
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */

// 125000.5 → "₹1,25,000.5" (Indian digit grouping, at most 2 decimals).
export function formatCurrency(value: number) {
    return `₹${value.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
    })}`;
}

// Date string or Date → "05 Oct 2026" by default. Callers can pass other options.
export function formatDate(
    value: string | Date,
    options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }
) {
    return new Date(value).toLocaleDateString("en-IN", options);
}

// (10, 2026) → "October 2026". `month` is 1-12 here, but JS Date months are 0-11, hence `month - 1`.
export function monthLabel(month: number, year: number) {
    return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
    });
}

// Local yyyy-mm-dd, for <input type="date"> values
// toISOString() is always in UTC, which can show the wrong day (e.g. just after
// midnight in India). Shifting by the timezone offset first keeps the LOCAL date.
export function toDateInputValue(value: string | Date = new Date()) {
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;

    return new Date(date.getTime() - offset).toISOString().split("T")[0];
}
