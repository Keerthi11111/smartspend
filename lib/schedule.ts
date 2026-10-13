/**
 * FILE: lib/schedule.ts
 * ROUTE: n/a (helper)
 *
 * WHAT IT DOES: advanceDate() moves a date forward by N weeks, months or years.
 * It is used to work out the next due date of a repeating bill or income.
 * WHERE IT FITS: Used by lib/recurring.ts (auto-posting due recurring items), the
 * recurring API routes, and pages that show upcoming bills (e.g. the calendar).
 * The Frequency values match the Frequency enum in prisma/schema.prisma.
 * WHY THIS CODE: Plain "add one month" is buggy: Jan 31 + 1 month becomes Mar 3.
 * We clamp to the last day of the target month (Jan 31 → Feb 28). All math uses
 * UTC methods so the server's timezone can't shift the date by a day.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */

// Same values as the Prisma `Frequency` enum.
export type Frequency = "WEEKLY" | "MONTHLY" | "YEARLY";

// Returns a NEW Date (the input is not changed) moved forward `steps` periods.
export function advanceDate(date: Date, frequency: Frequency, steps = 1) {
    const next = new Date(date);

    // Weeks are simple: always exactly 7 days each.
    if (frequency === "WEEKLY") {
        next.setUTCDate(next.getUTCDate() + 7 * steps);
        return next;
    }

    // Clamp to month end so the 31st doesn't spill into the next month
    // A year is treated as 12 months, so Feb 29 → Feb 28 in a non-leap year.
    const months = frequency === "MONTHLY" ? steps : 12 * steps;
    const day = next.getUTCDate();

    // Move to day 1 first so changing the month can't overflow.
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + months);

    // "Day 0 of the following month" = the last day of the target month.
    const lastDay = new Date(
        Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
    ).getUTCDate();

    // Put back the original day, but never past the end of the month.
    next.setUTCDate(Math.min(day, lastDay));

    return next;
}
