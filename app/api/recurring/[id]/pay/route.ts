/**
 * FILE: app/api/recurring/[id]/pay/route.ts
 * ROUTE: API: POST /api/recurring/:id/pay
 *
 * WHAT IT DOES: POST "marks a bill as paid": it creates a real transaction for
 * the current occurrence (dated today) and moves the item's next due date
 * forward by one week / month / year. With { skip: true } it only moves the
 * date forward without creating a transaction.
 * WHERE IT FITS: Called by app/dashboard/recurring/page.tsx ("Mark paid" and
 * "Skip" buttons, used for items that are NOT set to auto-add). Uses
 * getAuthenticatedUser, jsonError / parseId (lib/api.ts), advanceDate
 * (lib/recurring.ts → lib/schedule.ts) and the RecurringTransaction and
 * Expense models.
 * WHY THIS CODE: The date update and the new transaction run inside
 * prisma.$transaction, so either both happen or neither does. The update only
 * matches if nextDate is still the value we read; if a double click or a second
 * tab already moved it, nothing matches and we return 409 Conflict instead of
 * posting the same bill twice. The item is looked up by id AND userId (404 if
 * not ours). `params` is a Promise in Next 16.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { jsonError, parseId } from "@/lib/api";
import { advanceDate } from "@/lib/recurring";

// The [id] part of the URL (a Promise in Next 16)
type Props = {
    params: Promise<{ id: string }>;
};

// POST { skip?: boolean }: records this occurrence as a transaction dated
// today (or skips it), then moves the item to its next due date
export async function POST(request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check: load the item only if it belongs to this user
        const recurringId = parseId((await params).id);
        const item = recurringId
            ? await prisma.recurringTransaction.findFirst({
                  where: { id: recurringId, userId: user.id },
              })
            : null;

        if (!item) {
            return jsonError("Recurring transaction not found", 404);
        }

        // The body is optional: if it's empty or not JSON, treat it as {}
        const body = await request.json().catch(() => ({}));
        const skip = body.skip === true;

        // Work out the following due date (e.g. 5 May → 5 June for MONTHLY)
        const nextDate = advanceDate(item.nextDate, item.frequency);

        // Everything inside runs as one database transaction (all or nothing).
        // It returns true if this request handled the bill, false if another
        // request got there first.
        const posted = await prisma.$transaction(async (tx) => {
            // Guards against a double click posting the same bill twice
            const claimed = await tx.recurringTransaction.updateMany({
                where: { id: item.id, nextDate: item.nextDate },
                data: { nextDate },
            });

            // Lost the race (count 0) → false. Skipping → date already moved,
            // no transaction needed, so we stop here.
            if (claimed.count === 0 || skip) {
                return claimed.count > 0;
            }

            // Record the payment as a normal transaction dated today
            await tx.expense.create({
                data: {
                    title: item.title,
                    amount: item.amount,
                    type: item.type,
                    date: new Date(),
                    userId: user.id,
                    categoryId: item.categoryId,
                    accountId: item.accountId,
                },
            });

            return true;
        });

        // 409 Conflict: the item changed since the page loaded it
        if (!posted) {
            return jsonError("This bill was already updated. Refresh and try again.", 409);
        }

        // Send back the new due date so the page can update its list
        return NextResponse.json({ nextDate });
    } catch (error) {
        console.error("POST recurring pay error:", error);
        return jsonError("Failed to record payment", 500);
    }
}
