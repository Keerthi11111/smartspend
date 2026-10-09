import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";

export async function GET() {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized", status: 401 });
        }

        const now = new Date();

        const budgets = await prisma.budget.findMany({
            where: {
                userId: user.id,
                month: now.getMonth() + 1,
                year: now.getFullYear(),
            },

            include: {
                category: true
            },

            orderBy: {
                category: {
                    name: "asc",
                },
            },
        });

        const result = await Promise.all(
            budgets.map(async (budget) => {
                const spent = await prisma.expense.aggregate({
                    where: {
                        userId: user.id,
                        categoryId: budget.categoryId,
                        type: "EXPENSE",

                        date: {
                            gte: new Date(
                                now.getFullYear(),
                                now.getMonth(),
                                1
                            ),
                            lt: new Date(
                                now.getFullYear(),
                                now.getMonth() + 1,
                                1
                            ),
                        },
                    },

                    _sum: {
                        amount: true,
                    },
                });

                const spentAmount = spent._sum.amount || 0;

                return {
                    ...budget,
                    spent: spentAmount,
                    remaining: budget.amount - spentAmount,
                    percentage:
                        budget.amount > 0
                            ? (spentAmount / budget.amount) * 100
                            : 0,
                };
            })
        );

        return NextResponse.json(result);
    } catch (error) {
        console.log(error, "error");
        return NextResponse.json({ error: "Failed to retrieve the data", status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();

        const now = new Date();

        const budget = await prisma.budget.upsert({
            where: {
                userId_categoryId_month_year: {
                    userId: user.id,
                    categoryId: Number(body.categoryId),
                    month: body.month || now.getMonth() + 1,
                    year: body.year || now.getFullYear(),
                },
            },

            update: {
                amount: Number(body.amount),
            },

            create: {
                amount: Number(body.amount),
                categoryId: Number(body.categoryId),
                userId: user.id,
                month: body.month || now.getMonth() + 1,
                year: body.year || now.getFullYear(),
            },
        });

        return NextResponse.json(budget, {
            status: 201,
        });
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            { error: "Failed to save budget" },
            { status: 500 }
        );
    }
}