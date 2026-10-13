/**
 * FILE: app/dashboard/transactions/[id]/edit/page.tsx
 * ROUTE: /dashboard/transactions/[id]/edit   (e.g. /dashboard/transactions/42/edit)
 *
 * WHAT IT DOES: The "Edit Transaction" page. It reads the transaction id from
 * the URL, checks it is a valid positive whole number, and shows the shared
 * TransactionForm in "edit" mode for that id.
 * WHERE IT FITS: Reached from the edit (pencil) button on a row of the
 * Transactions list (/dashboard/transactions). The form calls
 * GET /api/transactions/[id] to pre-fill, GET /api/categories,
 * GET /api/accounts, and PUT /api/transactions/[id] to save.
 * WHY THIS CODE:
 * - It is an async server component (no "use client") so it can read the
 *   URL params before anything is sent to the browser.
 * - In Next 16 `params` is a Promise, so we must `await params`.
 * - PageProps<"..."> is a type Next.js generates for this route, so `id` is
 *   typed correctly.
 * - A bad id (e.g. "abc" or "-1") shows the 404 page right away instead of
 *   making a pointless API call.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { notFound } from "next/navigation";
import TransactionForm from "@/app/components/TransactionForm";

export default async function EditTransactionPage({
  params,
}: PageProps<"/dashboard/transactions/[id]/edit">) {
  // The [id] part of the URL arrives as a string; convert it to a number
  const { id } = await params;
  const transactionId = Number(id);

  // Only positive whole numbers are valid ids; anything else -> 404 page
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    notFound();
  }

  // Passing transactionId puts the shared form into "edit" mode
  return <TransactionForm transactionId={transactionId} />;
}
