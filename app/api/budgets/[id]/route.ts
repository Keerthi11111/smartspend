import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";

type Props = {
    params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: Props) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const budgetId = Number(id);

        if (!Number.isInteger(budgetId) || budgetId <= 0) {
            return NextResponse.json(
                { error: "Invalid budget ID" },
                { status: 400 }
            );
        }

        const body = await request.json();
        const amount = Number(body.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                { error: "Enter a valid budget amount" },
                { status: 400 }
            );
        }

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

export async function DELETE(
    request: Request,
    { params }: Props
) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { id } = await params;
        const budgetId = Number(id);

        if (!Number.isInteger(budgetId) || budgetId <= 0) {
            return NextResponse.json(
                { error: "Invalid budget ID" },
                { status: 400 }
            );
        }

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