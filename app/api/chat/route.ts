import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/get-auth-user";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { messages } = await req.json(); // [{ role: "user" | "model", text: "..." }]

    const expenses = await prisma.expense.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 100,
      select: {
        title: true,
        amount: true,
        type: true,
        date: true,
        category: { select: { name: true } },
      },
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      config: {
        systemInstruction: `You are an expense assistant inside a budgeting app.
Answer ONLY using the expense data below. If the answer is not in the data, say so.
Amounts are in INR (₹). Keep answers short and clear.
Expense data (JSON): ${JSON.stringify(expenses)}`,
      },
      contents: messages.map((m: { role: string; text: string }) => ({
        role: m.role,
        parts: [{ text: m.text }],
      })),
    });

    return NextResponse.json({ reply: response.text });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}