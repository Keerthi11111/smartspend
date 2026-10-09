import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";

type Props = {
  params: Promise<{ id: string }>;
};

// GET: Fetch one transaction belonging to the logged-in user
export async function GET(
  _request: Request,
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
    const transactionId = Number(id);

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

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
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const transactionId = Number(id);

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

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

    const body = await request.json();

    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    const amount = Number(body.amount);
    const categoryId = Number(body.categoryId);
    const type = body.type;

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

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

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

    const updatedTransaction = await prisma.expense.update({
      where: {
        id: transactionId,
      },
      data: {
        title,
        amount,
        type,
        categoryId,
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
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const transactionId = Number(id);

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

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

    await prisma.expense.delete({
      where: {
        id: transactionId,
      },
    });

    return NextResponse.json({
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    console.error("DELETE transaction error:", error);

    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}