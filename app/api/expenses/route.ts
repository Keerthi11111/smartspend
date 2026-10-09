import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({
      include: {
        category: true,
        user: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("GET expenses error:", error);

    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      title,
      amount,
      description,
      date,
      userId,
      categoryId,
    } = body;

    if (!title || !amount || !userId || !categoryId) {
      return NextResponse.json(
        {
          error:
            "title, amount, userId and categoryId are required",
        },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.create({
      data: {
        title,
        amount: Number(amount),
        description: description || null,
        date: date ? new Date(date) : new Date(),
        userId: Number(userId),
        categoryId: Number(categoryId),
      },
      include: {
        category: true,
        user: true,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("POST expense error:", error);

    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }
}