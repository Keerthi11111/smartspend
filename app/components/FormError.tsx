/**
 * FILE: app/components/FormError.tsx
 * ROUTE: n/a (component)
 *
 * WHAT IT DOES: Shows a red error box with a message, or nothing at all when
 * the message is empty.
 * WHERE IT FITS: Used by the forms on the Accounts, Bills & Recurring, Savings
 * Goals, Debts & Loans, Categories and Settings pages to display validation
 * or API errors. It calls no API.
 * WHY THIS CODE:
 * - Pages keep an `error` string in state ("" means no error). Passing it
 *   straight in means pages don't need their own `{error && ...}` check.
 * - One shared component keeps every error message looking the same.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
export default function FormError({ message }: { message: string }) {
    // Empty string = no error, so render nothing
    if (!message) return null;

    return (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {message}
        </div>
    );
}
