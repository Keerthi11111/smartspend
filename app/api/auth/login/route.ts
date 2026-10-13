/**
 * FILE: app/api/auth/login/route.ts
 * ROUTE: API: POST /api/auth/login
 *
 * WHAT IT DOES: POST checks an email + password against the database. If they
 * match, it creates a JWT login token and stores it in an httpOnly "token"
 * cookie, then returns the basic user info (never the password).
 * WHERE IT FITS: Called by the login form in app/login/page.tsx. Uses the
 * User model via lib/prisma.ts, bcryptjs to compare the hashed password, and
 * createToken() from lib/auth.ts. The cookie it sets is later read by proxy.ts
 * (page guard) and lib/get-auth-user.ts (every other API route).
 * WHY THIS CODE: The same "Invalid email or password" message is used for a
 * missing user and a wrong password, so attackers can't find out which emails
 * are registered. The cookie is httpOnly (JavaScript in the page can't read
 * it, which protects against XSS token theft), sameSite "strict" (helps block
 * CSRF) and secure in production (HTTPS only). 400 = bad input, 401 = wrong
 * credentials, 500 = unexpected server error.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";

// POST /api/auth/login — log a user in and set the "token" cookie.
// This is the one route that does NOT require a logged-in user (that's the point of it).
export async function POST(request: Request) {
    try {
        // Read the JSON body sent by the login form ({ email, password }).
        const body = await request.json();

        const { email, password } = body;

        // Basic validation: both fields are required. 400 = "Bad Request".
        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required" },
                {
                    status: 400,
                }
            );
        }

        // Look up the user by email. Email is unique in the schema, so findUnique works.
        const user = await prisma.user.findUnique({
            where: { email },
        });

        // No such user. We deliberately return the same message as a wrong
        // password so nobody can probe which emails have accounts.
        if (!user) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

        }

        // The database only stores a bcrypt hash, never the real password.
        // bcrypt.compare hashes the typed password the same way and checks if they match.
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }

        // Create a signed JWT that contains the user's id (see lib/auth.ts).
        const token = await createToken(user.id);

        // Send back only safe fields — the password hash must never leave the server.
        const response = NextResponse.json({
            message: "Login Successful",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            }
        });

        // Store the token in a cookie so the browser sends it automatically on
        // every later request. httpOnly = page JavaScript can't read it (XSS safety);
        // secure = HTTPS only in production; sameSite strict = not sent from other sites (CSRF safety);
        // path "/" = sent for every URL in the app.
        response.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 60 * 60 * 24 * 7, //7 days
            path: "/",
        });

        return response;

    } catch (error) {
        // Anything unexpected (bad JSON, database down...). Log the details on
        // the server, but only send a generic message to the browser.
        console.error("Login error:", error);

        return NextResponse.json({ error: "An error occurred during login" }, { status: 500 });
    }
}
