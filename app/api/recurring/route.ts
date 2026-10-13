/**
 * FILE: app/api/recurring/route.ts
 * ROUTE: API: GET, POST /api/recurring
 *
 * WHAT IT DOES: GET returns the user's recurring items (bills, subscriptions,
 * salary...) with their category and account. POST creates a new recurring
 * item (weekly / monthly / yearly).
 * WHERE IT FITS: Called by app/dashboard/recurring/page.tsx (list + create
 * form) and app/dashboard/calendar/page.tsx (shows upcoming bills). Uses
 * getAuthenticatedUser, findUserCategory / resolveAccountId / jsonError
 * (lib/api.ts), parseRecurringBody (lib/validation.ts), processDueRecurring
 * (lib/recurring.ts) and the RecurringTransaction, Category, Account models.
 * WHY THIS CODE: GET first runs processDueRecurring, which posts any overdue
 * "auto-add" items as real transactions and moves their next date forward;
 * doing it on read means no background cron job is needed. All queries are
 * filtered by userId. On POST the category and (optional) account must belong
 * to the user, otherwise 404; invalid fields return 400.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { findUserCategory, jsonError, resolveAccountId } from "@/lib/api";
import { parseRecurringBody } from "@/lib/validation";
import { processDueRecurring } from "@/lib/recurring";

// GET /api/recurring → all recurring items of the logged-in user
export async function GET() {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Post overdue auto-add items first, so the nextDate values we
        // return below are up to date
        await processDueRecurring(user.id);

        // Load items with just the category/account fields the page needs.
        // Active items first, then by the soonest due date.
        const items = await prisma.recurringTransaction.findMany({
            where: { userId: user.id },
            include: {
                category: { select: { id: true, name: true, color: true } },
                account: { select: { id: true, name: true } },
            },
            orderBy: [{ active: "desc" }, { nextDate: "asc" }],
        });

        return NextResponse.json(items);
    } catch (error) {
        console.error("GET recurring error:", error);
        return jsonError("Failed to fetch recurring transactions", 500);
    }
}

// POST /api/recurring → create a new recurring item
export async function POST(request: Request) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Validate title, amount, type, frequency, nextDate, categoryId, flags
        const body = await request.json();
        const parsed = parseRecurringBody(body);

        if (!parsed.data) {
            return jsonError(parsed.error, 400);
        }

        // Category must be a default one or the user's own
        if (!(await findUserCategory(user.id, parsed.data.categoryId))) {
            return jsonError("Category not found", 404);
        }

        // Account is optional: null = no account, undefined = an id was sent
        // but it is not one of this user's accounts
        const accountId = await resolveAccountId(user.id, body.accountId);

        if (accountId === undefined) {
            return jsonError("Account not found", 404);
        }

        // Save it, always tied to the logged-in user
        const item = await prisma.recurringTransaction.create({
            data: { ...parsed.data, accountId, userId: user.id },
        });

        return NextResponse.json(item, { status: 201 });
    } catch (error) {
        console.error("POST recurring error:", error);
        return jsonError("Failed to create recurring transaction", 500);
    }
}
