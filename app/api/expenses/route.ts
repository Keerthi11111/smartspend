/**
 * FILE: app/api/expenses/route.ts
 * ROUTE: API: GET, POST /api/expenses   (LEGACY — prefer /api/transactions)
 *
 * WHAT IT DOES: GET lists all of the logged-in user's transactions (newest
 * first, with category). POST creates one new transaction from { title,
 * amount, description?, date?, categoryId }.
 * WHERE IT FITS: Only used by the old demo form in app/expenses/page.tsx. The
 * real UI under app/dashboard uses /api/transactions instead. Uses
 * getAuthenticatedUser() (lib/get-auth-user.ts) and the Expense model.
 * WHY THIS CODE: Kept so the old page still works. It still checks the user
 * on every request and always saves/reads with the user's own id. Note that
 * its validation is simpler than /api/transactions (it does not check that
 * the category belongs to the user or that the amount is positive), which is
 * one reason new code should use /api/transactions.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";

// Legacy endpoint; prefer /api/transactions.
// GET /api/expenses — list every transaction of the logged-in user.
export async function GET() {
  try {
    // Auth check: no valid login cookie = 401 Unauthorized.
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only this user's rows (userId filter), newest first, with the category attached.
    const expenses = await prisma.expense.findMany({
      where: {
        userId: user.id,
      },
      include: {
        category: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    // Unexpected error: log on the server, generic 500 to the browser.
    console.error("GET expenses error:", error);

    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

// POST /api/expenses — create one transaction for the logged-in user.
export async function POST(request: Request) {
  try {
    // Auth check first — never create data for an unknown user.
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read the JSON body sent by the form.
    const body = await request.json();

    const { title, amount, description, date, categoryId } = body;

    // Minimal validation: title, amount and category are required (400 = Bad Request).
    if (!title || !amount || !categoryId) {
      return NextResponse.json(
        {
          error: "title, amount and categoryId are required",
        },
        { status: 400 }
      );
    }

    // Save the row. userId comes from the login cookie, NOT from the body, so
    // a user can't create records for someone else. Missing date = today.
    const expense = await prisma.expense.create({
      data: {
        title,
        amount: Number(amount),
        description: description || null,
        date: date ? new Date(date) : new Date(),
        userId: user.id,
        categoryId: Number(categoryId),
      },
      include: {
        category: true,
      },
    });

    // 201 = "Created".
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    // Unexpected error (bad JSON, unknown categoryId...): log it, return a generic 500.
    console.error("POST expense error:", error);

    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }
}
