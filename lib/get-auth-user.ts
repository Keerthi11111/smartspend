import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function getAuthenticatedUser() {
    const cookiesStore = await cookies();

    const token = cookiesStore.get("token")?.value;

    if (!token) {
        return null;
    }

    const payload = await verifyToken(token);

    if (!payload || typeof payload.userId !== "number") {
        return null;
    }

    const user = await prisma.user.findUnique({
        where: {
            id: payload.userId,
        },
        select: {
            id: true,
            name: true,
            email: true
        }
    });

    return user;
}