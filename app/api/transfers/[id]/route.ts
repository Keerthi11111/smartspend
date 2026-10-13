/**
 * FILE: app/api/transfers/[id]/route.ts
 * ROUTE: API: DELETE /api/transfers/:id
 *
 * WHAT IT DOES: DELETE removes one transfer between accounts. The account
 * balances update automatically because they are calculated from transfers.
 * WHERE IT FITS: Called by app/dashboard/accounts/page.tsx (delete button in
 * the recent transfers list). Uses getAuthenticatedUser, jsonError / parseId
 * (lib/api.ts) and the Transfer model.
 * WHY THIS CODE: deleteMany with { id, userId } does the ownership check and
 * the delete in ONE query: if the transfer is not this user's, nothing is
 * deleted (count 0) and we return 404. `params` is a Promise in Next 16, so
 * it is awaited before reading the id.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { jsonError, parseId } from "@/lib/api";

// The [id] part of the URL (a Promise in Next 16)
type Props = {
    params: Promise<{ id: string }>;
};

// DELETE /api/transfers/:id → remove one transfer
export async function DELETE(_request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        const transferId = parseId((await params).id);

        // Delete only if the id is valid AND the transfer belongs to this user.
        // An invalid id skips the query and behaves like "nothing deleted".
        const { count } = transferId
            ? await prisma.transfer.deleteMany({
                  where: { id: transferId, userId: user.id },
              })
            : { count: 0 };

        // Nothing deleted → it doesn't exist or isn't ours
        if (count === 0) {
            return jsonError("Transfer not found", 404);
        }

        return NextResponse.json({ message: "Transfer deleted" });
    } catch (error) {
        console.error("DELETE transfer error:", error);
        return jsonError("Failed to delete transfer", 500);
    }
}
