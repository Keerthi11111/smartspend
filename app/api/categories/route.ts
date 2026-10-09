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

        const categories = await prisma.category.findMany({
            orderBy: {
                name: "asc"
            }
        })

        return NextResponse.json(categories);
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: "Failed to fetch categories" },
            { status: 500 }
        );
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

        const name = body.name?.trim();

        if (!name) {
            return NextResponse.json(
                { error: "Category name is required" },
                { status: 400 }
            );
        }

        const existingCategory = await prisma.category.findUnique({
            where: {
                name,
            },
        });

        if (existingCategory) {
            return NextResponse.json(
                { error: "Category already exists" },
                { status: 409 }
            );
        }

        const category = await prisma.category.create({
            data: {
                name: body.name,
            },
        });

        return NextResponse.json(category, {
            status: 201,
        });
        
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            { error: "Failed to create category" },
            { status: 500 }
        );
    }
}