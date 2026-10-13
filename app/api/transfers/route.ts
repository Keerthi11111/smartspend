/**
 * FILE: app/api/transfers/route.ts
 * ROUTE: API: GET, POST /api/transfers
 *
 * WHAT IT DOES: GET returns the user's 20 most recent transfers between their
 * own accounts (e.g. Bank → Cash). POST records a new transfer.
 * WHERE IT FITS: Called by app/dashboard/accounts/page.tsx (recent transfers
 * list and "Transfer money" form). Uses getAuthenticatedUser and the parsing
 * helpers in lib/api.ts (parseAmount, parseId, parseDate, trimmedOrNull,
 * findUserAccount). Models: Transfer, Account.
 * WHY THIS CODE: A transfer moves money between accounts without counting as
 * income or expense, so it lives in its own table instead of Expense. The
 * account balances in GET /api/accounts add/subtract these rows. Both
 * accounts must belong to the logged-in user and must be different; the
 * amount must be positive. Bad input → 400, unknown account → 404.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import {
    findUserAccount,
    jsonError,
    parseAmount,
    parseDate,
    parseId,
    trimmedOrNull,
} from "@/lib/api";

// GET /api/transfers → latest 20 transfers, newest first
export async function GET() {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Only this user's transfers. "include" also loads the id + name of
        // both accounts so the page can show "Bank → Cash" without extra calls.
        const transfers = await prisma.transfer.findMany({
            where: { userId: user.id },
            include: {
                fromAccount: { select: { id: true, name: true } },
                toAccount: { select: { id: true, name: true } },
            },
            orderBy: { date: "desc" },
            take: 20,
        });

        return NextResponse.json(transfers);
    } catch (error) {
        console.error("GET transfers error:", error);
        return jsonError("Failed to fetch transfers", 500);
    }
}

// POST /api/transfers → move money from one account to another
export async function POST(request: Request) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        const body = await request.json();

        // Parse each field. The helpers return null when a value is invalid.
        // If no date is sent we use "now".
        const amount = parseAmount(body.amount);
        const fromId = parseId(body.fromAccountId);
        const toId = parseId(body.toAccountId);
        const date = body.date ? parseDate(body.date) : new Date();

        // Validation: reject bad input with 400 and a readable message
        if (!amount) {
            return jsonError("Amount must be greater than zero", 400);
        }

        // Moving money into the same account makes no sense
        if (!fromId || !toId || fromId === toId) {
            return jsonError("Choose two different accounts", 400);
        }

        if (!date) {
            return jsonError("Invalid date", 400);
        }

        // Make sure BOTH accounts belong to this user (looked up in parallel)
        const [fromAccount, toAccount] = await Promise.all([
            findUserAccount(user.id, fromId),
            findUserAccount(user.id, toId),
        ]);

        if (!fromAccount || !toAccount) {
            return jsonError("Account not found", 404);
        }

        // Save the transfer (note is optional; empty text becomes null)
        const transfer = await prisma.transfer.create({
            data: {
                amount,
                date,
                note: trimmedOrNull(body.note),
                userId: user.id,
                fromAccountId: fromAccount.id,
                toAccountId: toAccount.id,
            },
        });

        return NextResponse.json(transfer, { status: 201 });
    } catch (error) {
        console.error("POST transfer error:", error);
        return jsonError("Failed to create transfer", 500);
    }
}
