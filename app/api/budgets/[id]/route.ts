/**
 * FILE: app/api/budgets/[id]/route.ts
 * ROUTE: API: PUT, DELETE /api/budgets/:id
 *
 * WHAT IT DOES: PUT changes the amount of one budget. DELETE removes one
 * budget. (The category and month of a budget cannot be changed here.)
 * WHERE IT FITS: Called by app/dashboard/budgets/page.tsx (edit dialog and
 * delete button). Uses getAuthenticatedUser and the Budget model.
 * WHY THIS CODE: Before changing anything, the budget is looked up with BOTH
 * its id and the logged-in userId, so a user can't edit or delete another
 * user's budget by guessing an id (they get 404). The id from the URL is
 * checked to be a positive whole number (400 otherwise). `params` is a
 * Promise in Next 16, so it is awaited first.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";

// The [id] part of the URL (a Promise in Next 16)
type Props = {
    params: Promise<{ id: string }>;
}

// PUT /api/budgets/:id → update the budget amount
export async function PUT(request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const budgetId = Number(id);

        // The URL id must be a positive whole number
        if (!Number.isInteger(budgetId) || budgetId <= 0) {
            return NextResponse.json(
                { error: "Invalid budget ID" },
                { status: 400 }
            );
        }

        const body = await request.json();
        const amount = Number(body.amount);

        // Validation: amount must be a positive number
        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                { error: "Enter a valid budget amount" },
                { status: 400 }
            );
        }

        // Ownership check: find the budget only among this user's budgets
        const existingBudget = await prisma.budget.findFirst({
            where: {
                id: budgetId,
                userId: user.id,
            },
        });

        if (!existingBudget) {
            return NextResponse.json(
                { error: "Budget not found" },
                { status: 404 }
            );
        }

        // Update and return it with its category (the page shows the name)
        const updatedBudget = await prisma.budget.update({
            where: { id: budgetId },
            data: { amount },
            include: { category: true },
        });

        return NextResponse.json(updatedBudget);
    } catch (error) {
        console.error("Update budget error:", error);

        return NextResponse.json(
            { error: "Failed to update budget" },
            { status: 500 }
        );
    }
}

// DELETE /api/budgets/:id → remove a budget
export async function DELETE(
    request: Request,
    { params }: Props
) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { id } = await params;
        const budgetId = Number(id);

        // The URL id must be a positive whole number
        if (!Number.isInteger(budgetId) || budgetId <= 0) {
            return NextResponse.json(
                { error: "Invalid budget ID" },
                { status: 400 }
            );
        }

        // Ownership check (same as PUT)
        const existingBudget = await prisma.budget.findFirst({
            where: {
                id: budgetId,
                userId: user.id,
            },
        });

        if (!existingBudget) {
            return NextResponse.json(
                { error: "Budget not found" },
                { status: 404 }
            );
        }

        // Only the budget is removed; the transactions are not touched
        await prisma.budget.delete({
            where: { id: budgetId },
        });

        return NextResponse.json({
            message: "Budget deleted successfully",
        });
    } catch (error) {
        console.error("Delete budget error:", error);

        return NextResponse.json(
            { error: "Failed to delete budget" },
            { status: 500 }
        );
    }
}