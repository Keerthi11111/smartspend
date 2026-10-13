/**
 * FILE: lib/validation.ts
 * ROUTE: n/a (helper)
 *
 * WHAT IT DOES: Checks and cleans the JSON body sent to create/update an account,
 * savings goal, recurring transaction or debt. Each parser returns either
 * `{ data }` (clean values ready for Prisma) or `{ error }` (a message for the user).
 * WHERE IT FITS: Called by the POST/PUT handlers in app/api/accounts, app/api/goals,
 * app/api/recurring and app/api/debts. It builds on the small parsers in lib/api.ts.
 * The allowed enum values match the enums in prisma/schema.prisma.
 * WHY THIS CODE: Keeping validation out of the routes keeps POST and PUT using the
 * same rules. The `Parsed<T>` type means TypeScript knows `data` is safe to use once
 * you've checked there is no `error`.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { parseAmount, parseColor, parseDate, parseId, trimmedOrNull } from "@/lib/api";

// A parsed JSON request body: an object with unknown values (never trust them).
type Body = Record<string, unknown>;

// Result type: either success with `data`, or failure with an `error` message — never both.
type Parsed<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

// Allowed values, kept in sync with the AccountType and Frequency enums in schema.prisma.
// `as const` makes TypeScript treat them as exact string literals, not just `string`.
const accountTypes = ["CASH", "BANK", "CARD", "WALLET", "OTHER"] as const;
const frequencies = ["WEEKLY", "MONTHLY", "YEARLY"] as const;

// Validates the body for POST/PUT /api/accounts.
export function parseAccountBody(body: Body): Parsed<{
    name: string;
    type: (typeof accountTypes)[number];
    openingBalance: number;
    color: string;
}> {
    // `.find` returns the matching allowed value, or undefined if body.type isn't in the list.
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const type = accountTypes.find((value) => value === body.type);
    const openingBalance = Number(body.openingBalance ?? 0);

    if (!name) return { error: "Account name is required" };
    if (!type) return { error: "Invalid account type" };

    // Negative is allowed, e.g. a credit card that starts with dues
    if (!Number.isFinite(openingBalance)) {
        return { error: "Opening balance must be a number" };
    }

    return {
        data: { name, type, openingBalance, color: parseColor(body.color) },
    };
}

// Validates the body for POST/PUT /api/goals. The deadline is optional.
export function parseGoalBody(body: Body): Parsed<{
    name: string;
    targetAmount: number;
    deadline: Date | null;
    color: string;
}> {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const targetAmount = parseAmount(body.targetAmount);
    const deadline = body.deadline ? parseDate(body.deadline) : null;

    if (!name) return { error: "Goal name is required" };
    if (!targetAmount) return { error: "Target amount must be greater than zero" };
    // A deadline was sent but couldn't be parsed → error (an empty deadline is fine).
    if (body.deadline && !deadline) return { error: "Invalid deadline" };

    return {
        data: { name, targetAmount, deadline, color: parseColor(body.color) },
    };
}

// Validates the body for POST/PUT /api/recurring (bills, subscriptions, salary...).
// Note: this only checks that categoryId is a valid number. The route itself must
// check that the category belongs to the user.
export function parseRecurringBody(body: Body): Parsed<{
    title: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    frequency: (typeof frequencies)[number];
    nextDate: Date;
    autoAdd: boolean;
    active: boolean;
    categoryId: number;
}> {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const amount = parseAmount(body.amount);
    const frequency = frequencies.find((value) => value === body.frequency);
    const nextDate = parseDate(body.nextDate);
    const categoryId = parseId(body.categoryId as string);

    if (!title) return { error: "Title is required" };
    if (!amount) return { error: "Amount must be greater than zero" };
    if (!frequency) return { error: "Invalid frequency" };
    if (!nextDate) return { error: "Next due date is required" };
    if (!categoryId) return { error: "Category is required" };

    // Safe defaults: anything other than "INCOME" is an expense;
    // autoAdd is off unless exactly `true`; active is on unless exactly `false`.
    return {
        data: {
            title,
            amount,
            type: body.type === "INCOME" ? "INCOME" : "EXPENSE",
            frequency,
            nextDate,
            autoAdd: body.autoAdd === true,
            active: body.active !== false,
            categoryId,
        },
    };
}

// Validates the body for POST/PUT /api/debts (money lent to / borrowed from a person).
export function parseDebtBody(body: Body): Parsed<{
    personName: string;
    type: "LENT" | "BORROWED";
    amount: number;
    note: string | null;
    date: Date;
    dueDate: Date | null;
}> {
    const personName =
        typeof body.personName === "string" ? body.personName.trim() : "";
    const amount = parseAmount(body.amount);
    // No date sent → use today. Due date is optional.
    const date = body.date ? parseDate(body.date) : new Date();
    const dueDate = body.dueDate ? parseDate(body.dueDate) : null;

    if (!personName) return { error: "Person name is required" };
    // After this check TypeScript knows body.type is "LENT" | "BORROWED".
    if (body.type !== "LENT" && body.type !== "BORROWED") {
        return { error: "Choose whether you lent or borrowed" };
    }
    if (!amount) return { error: "Amount must be greater than zero" };
    if (!date) return { error: "Invalid date" };
    if (body.dueDate && !dueDate) return { error: "Invalid due date" };

    return {
        data: {
            personName,
            type: body.type,
            amount,
            note: trimmedOrNull(body.note),
            date,
            dueDate,
        },
    };
}
