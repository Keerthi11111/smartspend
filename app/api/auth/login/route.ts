import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required" },
                {
                    status: 400,
                }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }

        const token = await createToken(user.id);

        const response = NextResponse.json({
            message: "Login Successful",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            }
        });

        response.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 60 * 60 * 24 * 7, //7 days
            path: "/",
        });

        return response;

    } catch (error) {
        console.error("Login error:", error);

        return NextResponse.json({ error: "An error occurred during login" }, { status: 500 });
    }
}
