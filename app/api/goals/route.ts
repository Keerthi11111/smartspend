/**
 * FILE: app/api/goals/route.ts
 * ROUTE: API: GET, POST /api/goals
 *
 * WHAT IT DOES: GET returns the user's savings goals (e.g. "New laptop",
 * target 80,000). POST creates a new goal, optionally with an amount already
 * saved.
 * WHERE IT FITS: Called by app/dashboard/goals/page.tsx (list + create form).
 * Uses getAuthenticatedUser, jsonError (lib/api.ts), parseGoalBody
 * (lib/validation.ts) and the SavingsGoal model.
 * WHY THIS CODE: Every query is filtered by the logged-in userId. Goals with
 * the nearest deadline come first, and goals with no deadline go last, so the
 * most urgent ones are on top. The body is validated by a shared helper (the
 * same one PUT uses) and bad input returns 400; a successful create returns 201.
 * Progress % is calculated on the page from savedAmount / targetAmount.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { jsonError } from "@/lib/api";
import { parseGoalBody } from "@/lib/validation";

// GET /api/goals → all savings goals of the logged-in user
export async function GET() {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Sort by deadline (soonest first, "no deadline" last),
        // then by creation date for goals with the same deadline
        const goals = await prisma.savingsGoal.findMany({
            where: { userId: user.id },
            orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        });

        return NextResponse.json(goals);
    } catch (error) {
        console.error("GET goals error:", error);
        return jsonError("Failed to fetch goals", 500);
    }
}

// POST /api/goals → create a new savings goal
export async function POST(request: Request) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Validate name, targetAmount, deadline and color
        const body = await request.json();
        const parsed = parseGoalBody(body);

        if (!parsed.data) {
            return jsonError(parsed.error, 400);
        }

        // Optional starting amount ("I already saved 5,000"). Defaults to 0.
        // Zero is allowed here, but not negative numbers.
        const initial = Number(body.savedAmount ?? 0);

        if (!Number.isFinite(initial) || initial < 0) {
            return jsonError("Amount already saved cannot be negative", 400);
        }

        // Save the goal; userId always comes from the login cookie
        const goal = await prisma.savingsGoal.create({
            data: { ...parsed.data, savedAmount: initial, userId: user.id },
        });

        return NextResponse.json(goal, { status: 201 });
    } catch (error) {
        console.error("POST goal error:", error);
        return jsonError("Failed to create goal", 500);
    }
}
