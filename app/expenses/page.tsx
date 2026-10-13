/**
 * FILE: app/expenses/page.tsx
 * ROUTE: /expenses
 *
 * WHAT IT DOES: LEGACY DEMO PAGE. A very plain, unstyled form (title, amount,
 * description) that saves one expense. It was the first test of the API, built
 * before the real UI existed. The real screen is /dashboard/transactions
 * (add form: /dashboard/transactions/add).
 * WHERE IT FITS: No link in the app points here; you can only open it by typing the URL.
 * It is NOT protected by proxy.ts (not under /dashboard). It calls POST /api/expenses
 * (app/api/expenses/route.ts), which still requires login and returns 401 otherwise.
 * WHY THIS CODE: Kept only as a simple example of a client form posting JSON to an
 * API route. The hard-coded userId/categoryId were placeholders. The API now
 * ignores the body's userId and uses the logged-in user from the cookie instead.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client"

import { FormEvent, useState } from "react";

export default function ExpensesPage() {
    // Controlled form fields. `amount` is kept as a string because inputs give strings.
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");

    // Status text shown under the form ("Saving...", success or error).
    const [message, setMessage] = useState("");

    // Submit handler: send the form to the API as JSON.
    async function handleSubmit(e: FormEvent) {
        e.preventDefault();

        setMessage("Saving...");

        try {
            // POST /api/expenses creates one Expense row for the logged-in user.
            const response = await fetch("/api/expenses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title,
                    amount,
                    description,
                    // Temporary values
                    // (userId is ignored by the API; categoryId 1 must exist in the DB)
                    userId: 1,
                    categoryId: 1,
                })
            })
            const data = await response.json();

            if (!response.ok) {
                setMessage(data.error || "Failed to save expense");
                return;
            }

            setMessage("Expense added successfully!");

            // Clear the form so another expense can be entered.
            setTitle("");
            setAmount("");
            setDescription("");
        } catch (error) {
            console.error(error);
            setMessage("Something went wrong");
        }
    }

     return (
    <main style={{ padding: "40px" }}>
      <h1>Add Expense</h1>

      {/* Plain HTML form with no Tailwind styling (demo only) */}
      <form onSubmit={handleSubmit}>

        <div>
          <label>Title</label>
          <br />

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Example: Lunch"
          />
        </div>

        <br />

        <div>
          <label>Amount</label>
          <br />

          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Example: 150"
          />
        </div>

        <br />

        <div>
          <label>Description</label>
          <br />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: Office lunch"
          />
        </div>

        <br />

        <button type="submit">
          Add Expense
        </button>
      </form>

      {/* Result of the last save attempt */}
      <p>{message}</p>
    </main>
  );
}