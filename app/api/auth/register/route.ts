/**
 * FILE: app/api/auth/register/route.ts
 * ROUTE: API: POST /api/auth/register
 *
 * WHAT IT DOES: POST creates a new user account from { name, email, password }.
 * The password is hashed with bcrypt before saving. It does NOT log the user
 * in — the register page sends them to /login afterwards.
 * WHERE IT FITS: Called by the sign-up form in app/register/page.tsx. Uses the
 * User model through lib/prisma.ts and bcryptjs for hashing.
 * WHY THIS CODE: Passwords are never stored in plain text, so a database leak
 * doesn't reveal them. The email is checked first so we can return a clear
 * 409 "Conflict" instead of a database error. Only id/name/email are returned,
 * never the hash. 400 = missing/weak input, 201 = created, 500 = server error.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

// POST /api/auth/register — create a new account (no login required, obviously).
export async function POST(request: Request) {
    try {
        // Read the JSON body sent by the register form.
        const body = await request.json();

        const { name, email, password } = body;

        // Validation: every field is required, and the password must be at least 6 characters.
        if (!name || !email || !password) {
            return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 })
        }

        if (password.length < 6) {
            return NextResponse.json({ error: "Password must contain at least 6 characters" }, { status: 400 })
        }

        // Check whether this email is already taken (email is unique in the schema).
        const existingUser = await prisma.user.findUnique({ where: { email }, });

        // 409 = "Conflict": the resource (an account with this email) already exists.
        if (existingUser) {
            return NextResponse.json(
                {
                    error: "User already exists",
                },
                {
                    status: 409,
                }
            );
        }

        // Hash the password. 10 is the "salt rounds" (cost factor): higher = slower
        // to compute, which makes brute-force guessing harder. 10 is a common default.
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save the new user with the HASHED password only.
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            }
        });

        // 201 = "Created". Return safe fields only (no password hash).
        return NextResponse.json(
            {
                message: " User registered successfully",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                }
            },
            { status: 201 }
        );
    } catch (error) {
        // Unexpected failure: log details on the server, send a generic 500 to the browser.
        console.error("Register error:", error);
        return NextResponse.json({ error: "An error occuring while registering the user" }, { status: 500 })
    }

}