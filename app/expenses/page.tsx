"use client"

import { FormEvent, useState } from "react";

export default function ExpensesPage() {
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");

    const [message, setMessage] = useState("");

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();

        setMessage("Saving...");

        try {
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

      <p>{message}</p>
    </main>
  );
}