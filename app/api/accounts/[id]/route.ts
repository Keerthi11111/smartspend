/**
 * FILE: app/api/accounts/[id]/route.ts
 * ROUTE: API: PUT, DELETE /api/accounts/:id
 *
 * WHAT IT DOES: PUT updates one account (name, type, opening balance, color).
 * DELETE removes one account. Its transactions stay but become "no account";
 * its transfers are deleted.
 * WHERE IT FITS: Called by app/dashboard/accounts/page.tsx (edit form and
 * delete button). Uses getAuthenticatedUser, findUserAccount / jsonError /
 * parseId (lib/api.ts), parseAccountBody (lib/validation.ts) and the Account model.
 * WHY THIS CODE: The account is looked up by id AND userId (findUserAccount),
 * so a user cannot edit or delete someone else's account just by guessing an
 * id; they get 404 instead. In Next 16, `params` is a Promise, so we `await`
 * it before reading the id. What happens to linked rows on delete is set in
 * prisma/schema.prisma (Expense: SetNull, Transfer: Cascade).
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";
import { findUserAccount, jsonError, parseId } from "@/lib/api";
import { parseAccountBody } from "@/lib/validation";

// The [id] part of the URL. In Next 16 params arrive as a Promise.
type Props = {
    params: Promise<{ id: string }>;
};

// PUT /api/accounts/:id → edit an account
export async function PUT(request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Turn the URL id into a number, then load the account only if it
        // belongs to this user. Invalid id or someone else's account → 404.
        const accountId = parseId((await params).id);
        const account = accountId ? await findUserAccount(user.id, accountId) : null;

        if (!account) {
            return jsonError("Account not found", 404);
        }

        // Validate the new values (same rules as when creating)
        const parsed = parseAccountBody(await request.json());

        if (!parsed.data) {
            return jsonError(parsed.error, 400);
        }

        // Safe to update by id now: ownership was checked above
        const updated = await prisma.account.update({
            where: { id: account.id },
            data: parsed.data,
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PUT account error:", error);
        return jsonError("Failed to update account", 500);
    }
}

// DELETE /api/accounts/:id → remove an account
// Transactions keep existing (unassigned); transfers are removed
export async function DELETE(_request: Request, { params }: Props) {
    try {
        // Auth check
        const user = await getAuthenticatedUser();

        if (!user) {
            return jsonError("Unauthorized", 401);
        }

        // Ownership check (same as PUT)
        const accountId = parseId((await params).id);
        const account = accountId ? await findUserAccount(user.id, accountId) : null;

        if (!account) {
            return jsonError("Account not found", 404);
        }

        // The database handles linked rows (see onDelete rules in the schema)
        await prisma.account.delete({ where: { id: account.id } });

        return NextResponse.json({ message: "Account deleted" });
    } catch (error) {
        console.error("DELETE account error:", error);
        return jsonError("Failed to delete account", 500);
    }
}
