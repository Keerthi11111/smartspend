/**
 * FILE: app/api/debts/[id]/route.ts
 * ROUTE: API: PUT, PATCH, DELETE /api/debts/:id
 *
 * WHAT IT DOES: PUT edits a debt's details (person, type, amount, dates,
 * note). PATCH records a repayment, marks the debt fully settled, or reopens
 * it. DELETE removes the debt.
 * WHERE IT FITS: Called by app/dashboard/debts/page.tsx (edit form, "Record
 * payment", "Settle" / "Reopen" and delete buttons). Uses getAuthenticatedUser,
 * jsonError / parseAmount / parseId (lib/api.ts), parseDebtBody
 * (lib/validation.ts) and the Debt model.
 * WHY THIS CODE: findDebt() loads the debt by id AND userId, so users can only
 * touch their own debts (404 otherwise). paidAmount and settledAt are always
 * kept consistent: a debt counts as settled exactly when paidAmount reaches the
 * total amount. A tiny 0.001 tolerance avoids decimal rounding problems (e.g.
 * 0.1 + 0.2 is not exactly 0.3 in JavaScript). `params` is a Promise in Next 16.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { jsonError, parseAmount, parseId } from "@/lib/api";
import { parseDebtBody } from "@/lib/validation";

// The [id] part of the URL (a Promise in Next 16)
type Props = {
    params: Promise<{ id: string }>;
};

// Shared helper: returns the debt only if the id is valid AND it belongs to
// this user; otherwise null (turned into a 404 by the handlers)
async function findDebt(userId: number, id: string) {
    const debtId = parseId(id);

    return debtId ? prisma.debt.findFirst({ where: { id: debtId, userId } }) : null;
}

// PUT /api/debts/:id → edit the debt's details
export async function PUT(request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check
        const debt = await findDebt(user.id, (await params).id);

        if (!debt) {
            return jsonError("Debt not found", 404);
        }

        // Same validation rules as creating a debt
        const parsed = parseDebtBody(await request.json());

        if (!parsed.data) {
            return jsonError(parsed.error, 400);
        }

        // If the total amount was lowered below what was already repaid,
        // cap the paid amount at the new total
        const paidAmount = Math.min(debt.paidAmount, parsed.data.amount);

        // Settlement: fully paid → keep the old settled date if there was
        // one (or set it to now); otherwise mark it open again (null)
        const updated = await prisma.debt.update({
            where: { id: debt.id },
            data: {
                ...parsed.data,
                paidAmount,
                settledAt:
                    paidAmount >= parsed.data.amount ? debt.settledAt ?? new Date() : null,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PUT debt error:", error);
        return jsonError("Failed to update debt", 500);
    }
}

// PATCH { payment } records a partial repayment; { settle: true } closes it;
// { reopen: true } undoes a settlement
export async function PATCH(request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check
        const debt = await findDebt(user.id, (await params).id);

        if (!debt) {
            return jsonError("Debt not found", 404);
        }

        const body = await request.json();
        // How much is still left to repay
        const outstanding = debt.amount - debt.paidAmount;

        // Work out the new paid amount depending on which action was sent
        let paidAmount: number;

        if (body.reopen === true) {
            // Reopen: start again from nothing paid
            paidAmount = 0;
        } else if (body.settle === true) {
            // Settle: treat the whole amount as paid
            paidAmount = debt.amount;
        } else {
            // Partial payment: must be a positive number...
            const payment = parseAmount(body.payment);

            if (!payment) {
                return jsonError("Enter a valid payment amount", 400);
            }

            // ...and not more than what is still owed (0.001 = rounding slack)
            if (payment > outstanding + 0.001) {
                return jsonError("Payment is more than the outstanding amount", 400);
            }

            paidAmount = debt.paidAmount + payment;
        }

        // Settled when (almost exactly) the full amount is paid; otherwise
        // settledAt is cleared so the debt shows as open
        const updated = await prisma.debt.update({
            where: { id: debt.id },
            data: {
                paidAmount,
                settledAt: paidAmount >= debt.amount - 0.001 ? new Date() : null,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PATCH debt error:", error);
        return jsonError("Failed to update debt", 500);
    }
}

// DELETE /api/debts/:id → remove the debt
export async function DELETE(_request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check
        const debt = await findDebt(user.id, (await params).id);

        if (!debt) {
            return jsonError("Debt not found", 404);
        }

        await prisma.debt.delete({ where: { id: debt.id } });

        return NextResponse.json({ message: "Debt deleted" });
    } catch (error) {
        console.error("DELETE debt error:", error);
        return jsonError("Failed to delete debt", 500);
    }
}
