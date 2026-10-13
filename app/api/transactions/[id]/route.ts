/**
 * FILE: app/api/transactions/[id]/route.ts
 * ROUTE: API: GET, PUT, DELETE /api/transactions/:id
 *
 * WHAT IT DOES: Works on ONE transaction, picked by the id in the URL.
 * GET returns it (with its category), PUT updates it, DELETE removes it.
 * WHERE IT FITS: GET and PUT are called by app/components/TransactionForm.tsx
 * when used on the edit page app/dashboard/transactions/[id]/edit/page.tsx.
 * DELETE is called from the list in app/dashboard/transactions/page.tsx.
 * Uses getAuthenticatedUser(), findUserCategory / resolveAccountId
 * (lib/api.ts) and the Expense model.
 * WHY THIS CODE: Every handler first loads the transaction with BOTH its id
 * AND the user's id. If it belongs to someone else, the answer is 404 "not
 * found" — we don't even admit it exists. Only after that ownership check do
 * we update or delete by id. The id from the URL is validated (400 if not a
 * positive whole number). PUT keeps the old date/account/description when
 * those fields are not sent.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { findUserCategory, resolveAccountId } from "@/lib/api";

// The second argument Next.js passes to handlers in a [id] folder.
// In Next 16, params is a Promise, so we must `await params` to read the id.
type Props = {
  params: Promise<{ id: string }>;
};

// GET: Fetch one transaction belonging to the logged-in user
export async function GET(
  _request: Request,
  { params }: Props
) {
  try {
    // Auth check: no valid login cookie = 401 Unauthorized.
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Read the id from the URL and make sure it is a positive whole number.
    const { id } = await params;
    const transactionId = Number(id);

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

    // findFirst with id AND userId: returns nothing if the transaction belongs
    // to another user, so they get a 404 just like a missing one.
    const transaction = await prisma.expense.findFirst({
      where: {
        id: transactionId,
        userId: user.id,
      },
      include: {
        category: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    // Unexpected error: log on the server, generic 500 to the browser.
    console.error("GET transaction error:", error);

    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 500 }
    );
  }
}

// PUT: Update one transaction belonging to the logged-in user
export async function PUT(
  request: Request,
  { params }: Props
) {
  try {
    // Auth check: no valid login cookie = 401 Unauthorized.
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Validate the id from the URL (must be a positive whole number).
    const { id } = await params;
    const transactionId = Number(id);

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

    // Ownership check: load the transaction only if it belongs to this user.
    // We also keep it to fall back on its old values for fields not sent.
    const existingTransaction = await prisma.expense.findFirst({
      where: {
        id: transactionId,
        userId: user.id,
      },
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Read the JSON body and normalise the main fields before validating them.
    const body = await request.json();

    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    const amount = Number(body.amount);
    const categoryId = Number(body.categoryId);
    const type = body.type;

    // Validation: each check returns 400 with a clear message so the form can show it.
    if (!title) {
      return NextResponse.json(
        { error: "Transaction title is required" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    if (type !== "INCOME" && type !== "EXPENSE") {
      return NextResponse.json(
        { error: "Invalid transaction type" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // The new category must be a shared default or one of this user's own.
    const category = await findUserCategory(user.id, categoryId);

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // accountId not sent at all = keep the current account.
    // Otherwise resolveAccountId gives null (no account), a valid id owned by
    // this user, or undefined (invalid / someone else's account -> 404).
    const accountId =
      body.accountId === undefined
        ? existingTransaction.accountId
        : await resolveAccountId(user.id, body.accountId);

    if (accountId === undefined) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Date is optional on update: keep the old date unless a new, valid one is sent.
    let transactionDate = existingTransaction.date;

    if (body.date !== undefined) {
      if (
        typeof body.date !== "string" ||
        body.date.trim() === ""
      ) {
        return NextResponse.json(
          { error: "Invalid transaction date" },
          { status: 400 }
        );
      }

      transactionDate = new Date(body.date);

      if (Number.isNaN(transactionDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid transaction date" },
          { status: 400 }
        );
      }
    }

    // Description may be missing, null, or text — anything else is rejected.
    if (
      body.description !== undefined &&
      body.description !== null &&
      typeof body.description !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid description" },
        { status: 400 }
      );
    }

    // Safe to update by id alone now, because we already confirmed above that
    // this transaction belongs to the user.
    // Description: text -> trimmed (empty becomes null); null -> cleared;
    // not sent -> keep the existing description.
    const updatedTransaction = await prisma.expense.update({
      where: {
        id: transactionId,
      },
      data: {
        title,
        amount,
        type,
        categoryId,
        accountId,
        date: transactionDate,
        description:
          typeof body.description === "string"
            ? body.description.trim() || null
            : body.description === null
              ? null
              : existingTransaction.description,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(updatedTransaction);
  } catch (error) {
    // Unexpected error: log on the server, generic 500 to the browser.
    console.error("PUT transaction error:", error);

    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

// DELETE: Delete only the logged-in user's transaction
export async function DELETE(
  _request: Request,
  { params }: Props
) {
  try {
    // Auth check: no valid login cookie = 401 Unauthorized.
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Validate the id from the URL (must be a positive whole number).
    const { id } = await params;
    const transactionId = Number(id);

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

    // Ownership check before deleting: the row must match this id AND this user.
    const existingTransaction = await prisma.expense.findFirst({
      where: {
        id: transactionId,
        userId: user.id,
      },
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Now it's safe to delete by id.
    await prisma.expense.delete({
      where: {
        id: transactionId,
      },
    });

    return NextResponse.json({
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    // Unexpected error: log on the server, generic 500 to the browser.
    console.error("DELETE transaction error:", error);

    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}