/**
 * FILE: app/api/debts/route.ts
 * ROUTE: API: GET, POST /api/debts
 *
 * WHAT IT DOES: GET returns the user's debts and loans: money they LENT to
 * someone or BORROWED from someone. POST records a new one.
 * WHERE IT FITS: Called by app/dashboard/debts/page.tsx (list + create form).
 * Uses getAuthenticatedUser, jsonError (lib/api.ts), parseDebtBody
 * (lib/validation.ts) and the Debt model.
 * WHY THIS CODE: Every query is filtered by the logged-in userId. The sort
 * order puts open (unsettled) debts first, then the ones due soonest, so what
 * needs attention is at the top. A new debt starts with paidAmount 0 (the
 * schema default); repayments are recorded later with PATCH /api/debts/:id.
 * Bad input → 400, created → 201.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { jsonError } from "@/lib/api";
import { parseDebtBody } from "@/lib/validation";

// GET /api/debts → all debts/loans of the logged-in user
export async function GET() {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Sort order:
        // 1. open debts first (settledAt is null for those), then settled ones
        //    with the most recently settled first
        // 2. soonest due date first (no due date goes last)
        // 3. newest debt first
        const debts = await prisma.debt.findMany({
            where: { userId: user.id },
            orderBy: [
                { settledAt: { sort: "desc", nulls: "first" } },
                { dueDate: { sort: "asc", nulls: "last" } },
                { date: "desc" },
            ],
        });

        return NextResponse.json(debts);
    } catch (error) {
        console.error("GET debts error:", error);
        return jsonError("Failed to fetch debts", 500);
    }
}

// POST /api/debts → record a new debt or loan
export async function POST(request: Request) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Validate personName, type (LENT/BORROWED), amount, dates and note
        const parsed = parseDebtBody(await request.json());

        if (!parsed.data) {
            return jsonError(parsed.error, 400);
        }

        // Save it, tied to the logged-in user
        const debt = await prisma.debt.create({
            data: { ...parsed.data, userId: user.id },
        });

        return NextResponse.json(debt, { status: 201 });
    } catch (error) {
        console.error("POST debt error:", error);
        return jsonError("Failed to create debt", 500);
    }
}
