import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";

export async function GET(request: Request) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search") || "";

        const transactions = await prisma.expense.findMany({
            where: {
                userId: user.id,

                OR: search ? [
                    {
                        title: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                    {
                        description: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                    {
                        category: {
                            name: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                    },
                ]
                    : undefined
            },

            include: {
                category: true
            },
            orderBy: {
                date: "desc",
            }
        });

        return NextResponse.json(transactions);

    } catch (error) {
        console.error("GET transactions error:", error);

        return NextResponse.json(
            { error: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {

        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json();

        const { title, amount, type, description, date, categoryId } = body;

        if (!title || !amount || !categoryId) {
            return NextResponse.json(
                {
                    error: "Title, amount and category are required",
                },
                { status: 400 }
            );
        }

        const transaction = await prisma.expense.create({
            data: {
                title,
                amount: Number(amount),
                type: type === "INCOME" ? "INCOME" : "EXPENSE",
                description: description || null,
                date: date ? new Date(date) : new Date(),

                userId: user.id,
                categoryId: Number(categoryId),
            },

            include: {
                category: true
            }

        })

        return NextResponse.json(transaction, {
            status: 201
        });
    } catch (error) {
        console.error("POST transaction error:", error);

        return NextResponse.json(
            { error: "Failed to create transaction" },
            { status: 500 }
        );
    }
}