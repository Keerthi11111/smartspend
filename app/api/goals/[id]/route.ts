/**
 * FILE: app/api/goals/[id]/route.ts
 * ROUTE: API: PUT, PATCH, DELETE /api/goals/:id
 *
 * WHAT IT DOES: PUT edits a goal's details (name, target, deadline, color).
 * PATCH adds money to the goal (positive amount) or withdraws money from it
 * (negative amount). DELETE removes the goal.
 * WHERE IT FITS: Called by app/dashboard/goals/page.tsx (edit form, "Add /
 * Withdraw money" dialog, delete button). Uses getAuthenticatedUser,
 * jsonError / parseId (lib/api.ts), parseGoalBody (lib/validation.ts) and
 * the SavingsGoal model.
 * WHY THIS CODE: findGoal() loads the goal by id AND userId, so every handler
 * only works on the logged-in user's own goals (404 otherwise). PUT does not
 * touch savedAmount; money only changes through PATCH, which blocks taking out
 * more than was saved and uses Prisma's atomic "increment" so two quick
 * clicks can't overwrite each other. `params` is a Promise in Next 16.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { jsonError, parseId } from "@/lib/api";
import { parseGoalBody } from "@/lib/validation";

// The [id] part of the URL (a Promise in Next 16)
type Props = {
    params: Promise<{ id: string }>;
};

// Shared helper: returns the goal only if the id is valid AND it belongs to
// this user; otherwise null (the handlers turn null into a 404)
async function findGoal(userId: number, id: string) {
    const goalId = parseId(id);

    return goalId
        ? prisma.savingsGoal.findFirst({ where: { id: goalId, userId } })
        : null;
}

// PUT /api/goals/:id → edit the goal's details
export async function PUT(request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check
        const goal = await findGoal(user.id, (await params).id);

        if (!goal) {
            return jsonError("Goal not found", 404);
        }

        // Same validation rules as creating a goal
        const parsed = parseGoalBody(await request.json());

        if (!parsed.data) {
            return jsonError(parsed.error, 400);
        }

        // savedAmount is not in parsed.data, so it stays unchanged
        const updated = await prisma.savingsGoal.update({
            where: { id: goal.id },
            data: parsed.data,
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PUT goal error:", error);
        return jsonError("Failed to update goal", 500);
    }
}

// PATCH { amount }: positive adds money to the goal, negative withdraws
export async function PATCH(request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check
        const goal = await findGoal(user.id, (await params).id);

        if (!goal) {
            return jsonError("Goal not found", 404);
        }

        const amount = Number((await request.json()).amount);

        // Must be a real, non-zero number (0 would change nothing)
        if (!Number.isFinite(amount) || amount === 0) {
            return jsonError("Enter a valid amount", 400);
        }

        // The saved total can never drop below zero
        if (goal.savedAmount + amount < 0) {
            return jsonError("You can't withdraw more than you've saved", 400);
        }

        // "increment" lets the database do savedAmount = savedAmount + amount
        // in one step, instead of us writing back a value we read earlier
        const updated = await prisma.savingsGoal.update({
            where: { id: goal.id },
            data: { savedAmount: { increment: amount } },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PATCH goal error:", error);
        return jsonError("Failed to update goal", 500);
    }
}

// DELETE /api/goals/:id → remove the goal
export async function DELETE(_request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check
        const goal = await findGoal(user.id, (await params).id);

        if (!goal) {
            return jsonError("Goal not found", 404);
        }

        await prisma.savingsGoal.delete({ where: { id: goal.id } });

        return NextResponse.json({ message: "Goal deleted" });
    } catch (error) {
        console.error("DELETE goal error:", error);
        return jsonError("Failed to delete goal", 500);
    }
}
