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

        const startOfMonth = new Date(
            now.getFullYear(),
            now.getMonth()
        );

        const endOfMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59
        );

        const income = await prisma.expense.aggregate({
            where: {
                userId: user.id,
                type: "INCOME",
            },
            _sum: {
                amount: true,
            },
        });

        const expenses = await prisma.expense.aggregate({
            where: {
                userId: user.id,
                type: "EXPENSE",
            },
            _sum: {
                amount: true,
            },
        });

        const monthlyIncome = await prisma.expense.aggregate({
            where: {
                userId: user.id,
                type: "INCOME",
                date: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
            _sum: {
                amount: true,
            },
        });

        const monthlyExpenses = await prisma.expense.aggregate({
            where: {
                userId: user.id,
                type: "EXPENSE",
                date: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
            _sum: {
                amount: true,
            },
        });

        const recentTransactions =
            await prisma.expense.findMany({
                where: {
                    userId: user.id,
                },

                include: {
                    category: true,
                },

                orderBy: {
                    date: "desc",
                },

                take: 5,
            });

        const totalIncome = income._sum.amount || 0;
        const totalExpenses = expenses._sum.amount || 0;

        const currentMonthIncome =
            monthlyIncome._sum.amount || 0;

        const currentMonthExpenses =
            monthlyExpenses._sum.amount || 0;

        return NextResponse.json({
            totalIncome,
            totalExpenses,

            balance: totalIncome - totalExpenses,

            savings: totalIncome - totalExpenses,

            monthlySummary: {
                income: currentMonthIncome,
                expenses: currentMonthExpenses,
                savings:
                    currentMonthIncome - currentMonthExpenses,
            },

            recentTransactions,
        });

    } catch (error) {
        console.error("Dashboard error:", error);

        return NextResponse.json(
            { error: "Failed to fetch dashboard data" },
            { status: 500 }
        );
    }
}