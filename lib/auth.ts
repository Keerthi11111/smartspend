/**
 * FILE: lib/auth.ts
 * ROUTE: n/a (helper)
 *
 * WHAT IT DOES: Creates and checks JWT login tokens. createToken() makes a signed
 * token that holds the user's id. verifyToken() checks a token and returns its
 * contents, or null if it is fake, changed or expired.
 * WHERE IT FITS: createToken() is called by POST /api/auth/login after the password
 * matches. The token is stored in the "token" cookie. verifyToken() is called by
 * proxy.ts (page guard) and lib/get-auth-user.ts (API routes).
 * WHY THIS CODE: We use `jose` instead of `jsonwebtoken` because jose works in every
 * Next.js runtime, including the one proxy.ts runs in. HS256 signs with one secret
 * (JWT_SECRET), so only this server can create valid tokens. Tokens expire after
 * 7 days, so a stolen token stops working eventually.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { SignJWT, jwtVerify } from "jose";

// The signing secret comes from .env. Without it nobody could log in, so stop right away.
const secret = process.env.JWT_SECRET;

if (!secret) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}

// jose wants the key as bytes (Uint8Array), not a plain string.
const secretKey = new TextEncoder().encode(secret);

// Build a signed token like "header.payload.signature" holding { userId }.
// It records when it was issued and expires 7 days later.
export async function createToken(userId: number) {
    return await new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secretKey);
}

// Check the signature and expiry. Return the payload (e.g. { userId, iat, exp })
// if valid. Return null instead of throwing, so callers can do a simple `if (!payload)`.
export async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, secretKey);
        return payload;
    } catch (error) {
        return null;
    }
}