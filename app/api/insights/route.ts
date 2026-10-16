import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
    try {

        const { expenses } = await req.json();

        const prompt = `You are a personal finanace assistant.Here are the user's expenses as JSON:${JSON.stringify(expenses)} Write a short summary (max 4 lines) of where the money went, mension the biggest category, and give one practical saving tip.`;

        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash-lite",
            contents: prompt,
        });

        return NextResponse.json({ summary: response.text });

    } catch (error) {
        console.error("Insights error:", error);
        return NextResponse.json({ error: "Could not generate insights" }, { status: 500 });
    }
}

