/**
 * FILE: app/dashboard/transactions/add/page.tsx
 * ROUTE: /dashboard/transactions/add
 *
 * WHAT IT DOES: The "Add Transaction" page. It just shows the shared
 * TransactionForm in "add" mode.
 * WHERE IT FITS: Reached from the "Add Transaction" buttons on the Dashboard
 * and Transactions pages. The form calls GET /api/categories,
 * GET /api/accounts, POST /api/categories and POST /api/transactions, then
 * returns to /dashboard/transactions.
 * WHY THIS CODE:
 * - All the form logic lives in app/components/TransactionForm.tsx so the add
 *   and edit pages share it. This file only decides the mode.
 * - No "use client" here: this page is a tiny server component that renders
 *   a client component (TransactionForm has its own "use client").
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import TransactionForm from "@/app/components/TransactionForm";

export default function AddTransactionPage() {
  // No transactionId prop = the form runs in "add" mode
  return <TransactionForm />;
}
