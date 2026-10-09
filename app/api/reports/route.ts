import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();

    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - 5,
      1
    );

    const transactions = await prisma.expense.findMany({
      where: {
        userId: user.id,

        date: {
          gte: startDate,
        },
      },

      include: {
        category: true,
      },

      orderBy: {
        date: "asc",
      },
    });

    const monthlyData: Record<
      string,
      {
        income: number;
        expense: number;
      }
    > = {};

    transactions.forEach((transaction) => {
      const month = transaction.date.toLocaleString(
        "en-US",
        {
          month: "short",
        }
      );

      if (!monthlyData[month]) {
        monthlyData[month] = {
          income: 0,
          expense: 0,
        };
      }

      if (transaction.type === "INCOME") {
        monthlyData[month].income += transaction.amount;
      } else {
        monthlyData[month].expense += transaction.amount;
      }
    });

    const monthlyReport = Object.entries(
      monthlyData
    ).map(([month, values]) => ({
      month,
      income: values.income,
      expense: values.expense,
    }));

    const categoryData: Record<string, number> = {};

    transactions
      .filter(
        (transaction) =>
          transaction.type === "EXPENSE"
      )
      .forEach((transaction) => {
        const category =
          transaction.category.name;

        categoryData[category] =
          (categoryData[category] || 0) +
          transaction.amount;
      });

    const categoryReport = Object.entries(
      categoryData
    ).map(([category, amount]) => ({
      category,
      amount,
    }));

    return NextResponse.json({
      monthlyReport,
      categoryReport,
    });
  } catch (error) {
    console.error("Reports error:", error);

    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}