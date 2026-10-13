/**
 * FILE: app/api/recurring/[id]/route.ts
 * ROUTE: API: PUT, DELETE /api/recurring/:id
 *
 * WHAT IT DOES: PUT edits one recurring item (title, amount, frequency, next
 * date, category, account, auto-add, active/paused). DELETE removes it.
 * Transactions that were already posted from it are kept.
 * WHERE IT FITS: Called by app/dashboard/recurring/page.tsx (edit form,
 * pause/resume toggle, delete button). Uses getAuthenticatedUser,
 * findUserCategory / resolveAccountId / parseId / jsonError (lib/api.ts),
 * parseRecurringBody (lib/validation.ts) and the RecurringTransaction model.
 * WHY THIS CODE: findRecurring() loads the item by id AND userId, so users can
 * only change their own items (404 otherwise). PUT uses the same validation as
 * POST and re-checks that the category and account belong to the user, so a
 * user can't link someone else's account. `params` is a Promise in Next 16.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { findUserCategory, jsonError, parseId, resolveAccountId } from "@/lib/api";
import { parseRecurringBody } from "@/lib/validation";

// The [id] part of the URL (a Promise in Next 16)
type Props = {
    params: Promise<{ id: string }>;
};

// Shared helper: returns the item only if the id is valid AND it belongs to
// this user; otherwise null (turned into a 404 by the handlers)
async function findRecurring(userId: number, id: string) {
    const recurringId = parseId(id);

    return recurringId
        ? prisma.recurringTransaction.findFirst({ where: { id: recurringId, userId } })
        : null;
}

// PUT /api/recurring/:id → edit a recurring item
export async function PUT(request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check
        const item = await findRecurring(user.id, (await params).id);

        if (!item) {
            return jsonError("Recurring transaction not found", 404);
        }

        // Validate the full body (same rules as creating)
        const body = await request.json();
        const parsed = parseRecurringBody(body);

        if (!parsed.data) {
            return jsonError(parsed.error, 400);
        }

        // Category must be a default one or the user's own
        if (!(await findUserCategory(user.id, parsed.data.categoryId))) {
            return jsonError("Category not found", 404);
        }

        // Optional account: null = none, undefined = not the user's account
        const accountId = await resolveAccountId(user.id, body.accountId);

        if (accountId === undefined) {
            return jsonError("Account not found", 404);
        }

        const updated = await prisma.recurringTransaction.update({
            where: { id: item.id },
            data: { ...parsed.data, accountId },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PUT recurring error:", error);
        return jsonError("Failed to update recurring transaction", 500);
    }
}

// DELETE /api/recurring/:id → remove a recurring item
export async function DELETE(_request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check
        const item = await findRecurring(user.id, (await params).id);

        if (!item) {
            return jsonError("Recurring transaction not found", 404);
        }

        // Only the schedule is deleted; past transactions stay in Expense
        await prisma.recurringTransaction.delete({ where: { id: item.id } });

        return NextResponse.json({ message: "Recurring transaction deleted" });
    } catch (error) {
        console.error("DELETE recurring error:", error);
        return jsonError("Failed to delete recurring transaction", 500);
    }
}
