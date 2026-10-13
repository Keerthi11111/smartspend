/**
 * FILE: lib/recurring.ts
 * ROUTE: n/a (helper)
 *
 * WHAT IT DOES: processDueRecurring(userId) finds the user's recurring items that
 * are set to "auto-add" and are due. It creates the matching income/expense rows,
 * then moves each item's nextDate forward.
 * WHERE IT FITS: Called at the start of API routes that read transaction data (e.g.
 * GET /api/dashboard, /api/transactions, /api/accounts, /api/recurring), so the data
 * is up to date.
 * It reads RecurringTransaction and writes Expense rows through prisma (lib/prisma.ts),
 * and uses advanceDate() from lib/schedule.ts.
 * WHY THIS CODE: There is no background job (cron). Due items are posted "lazily" the
 * next time the user loads data. A conditional update inside a DB transaction makes
 * sure two requests at the same time can't post the same bill twice.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { prisma } from "@/lib/prisma";
import { advanceDate } from "@/lib/schedule";

// Re-exported so routes can import both helpers from one place.
export { advanceDate };

// Safety limit: post at most 60 missed occurrences per item in one go
// (e.g. a weekly item not checked for years won't create thousands of rows).
const MAX_CATCH_UP = 60;

// Posts every overdue occurrence of the user's auto-add items as a transaction.
// Run lazily whenever transaction data is read, so no cron job is needed.
export async function processDueRecurring(userId: number) {
    const now = new Date();

    // Only this user's items that are active, auto-add, and due today or earlier.
    const dueItems = await prisma.recurringTransaction.findMany({
        where: {
            userId,
            active: true,
            autoAdd: true,
            nextDate: { lte: now },
        },
    });

    for (const item of dueItems) {
        // Collect every missed due date (up to the cap), and find the first FUTURE
        // due date. That becomes the new nextDate. The loop keeps advancing even past
        // the cap, so nextDate always ends up in the future.
        const dates: Date[] = [];
        let next = item.nextDate;

        while (next <= now) {
            if (dates.length < MAX_CATCH_UP) dates.push(next);
            next = advanceDate(next, item.frequency);
        }

        // $transaction: the update and the inserts succeed or fail together.
        await prisma.$transaction(async (tx) => {
            // Only the request that moves nextDate posts the transactions,
            // so concurrent page loads can't create duplicates
            // (the `where` includes the OLD nextDate, so a second request matches 0 rows).
            const claimed = await tx.recurringTransaction.updateMany({
                where: { id: item.id, nextDate: item.nextDate },
                data: { nextDate: next },
            });

            if (claimed.count === 0) return;

            // One Expense row (income or expense, per item.type) for each missed date.
            await tx.expense.createMany({
                data: dates.map((date) => ({
                    title: item.title,
                    amount: item.amount,
                    type: item.type,
                    date,
                    userId: item.userId,
                    categoryId: item.categoryId,
                    accountId: item.accountId,
                    description: "Added automatically (recurring)",
                })),
            });
        });
    }
}
