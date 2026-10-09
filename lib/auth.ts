import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;

if (!secret) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}

const secretKey = new TextEncoder().encode(secret);

export async function createToken(userId: number) {
    return await new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setAudience("7d")
        .sign(secretKey);
}

export async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, secretKey);
        return payload;
    } catch (error) {
        return null;
    }
}