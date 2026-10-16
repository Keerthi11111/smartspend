"use client";

import { Bot, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "model"; text: string };

const suggestions = [
  "How much did I spend this month?",
  "What is my biggest expense category?",
  "List my last 5 expenses",
];

// "floating" = round button in the corner that opens a pop-up panel.
// "page" = the chat fills its container (used by /dashboard/assistant).
interface ExpenseChatProps {
  variant?: "floating" | "page";
}

export default function ExpenseChat({ variant = "floating" }: ExpenseChatProps) {
  const isPage = variant === "page";
  const [open, setOpen] = useState(isPage);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text = input) {
    if (!text.trim() || loading) return;
    const next: Msg[] = [...messages, { role: "user", text: text.trim() }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([
        ...next,
        { role: "model", text: data.reply ?? data.error ?? "Sorry, something went wrong." },
      ]);
    } catch {
      setMessages([...next, { role: "model", text: "Network error. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open && !isPage) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open expense assistant"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div
      className={
        isPage
          ? "flex h-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
          : "fixed bottom-6 right-6 z-50 flex h-[32rem] max-h-[calc(100vh-3rem)] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-400/10 p-1.5 text-cyan-400">
            <Bot size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Expense Assistant</p>
            <p className="text-xs text-slate-500">Ask about your spending</p>
          </div>
        </div>
        {!isPage && (
          <button
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Try asking:</p>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-slate-800 px-3 py-2 text-left text-sm text-slate-300 transition hover:border-cyan-500/50 hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={`max-w-[85%] ${isPage ? "md:max-w-[70%]" : ""} whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "rounded-br-sm bg-cyan-500 text-slate-950"
                  : "rounded-bl-sm bg-slate-800 text-slate-100"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-sm bg-slate-800 px-3 py-2 text-sm text-slate-400">
              Thinking…
            </p>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 border-t border-slate-800 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your spending..."
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="rounded-lg bg-cyan-500 px-3 text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
