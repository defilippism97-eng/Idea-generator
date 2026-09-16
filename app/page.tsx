"use client";

import { useEffect, useRef, useState } from "react";
import { BLUEPRINT_TRIGGER, VANTAGE_GREETING } from "@/lib/vantage";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: VANTAGE_GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(mode: "interview" | "blueprint", overrideContent?: string) {
    const content = overrideContent ?? input.trim();
    if (!content || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, mode }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Errore nella richiesta (HTTP ${res.status}).`);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: full };
          return copy;
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Errore sconosciuto. Se la risposta era lunga (Fase 3), potrebbe essere un timeout: riprova.",
      );
    } finally {
      setLoading(false);
    }
  }

  const userTurns = messages.filter((m) => m.role === "user").length;

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Vantage</h1>
        <p className="text-sm text-neutral-400">
          Senior Product Strategist &amp; Venture Architect — profilazione e MVP blueprint
        </p>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col gap-4">
          {messages.map((m, i) => {
            const isStreamingEmpty =
              loading && i === messages.length - 1 && m.role === "assistant" && m.content === "";
            return (
              <div
                key={i}
                className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "assistant"
                    ? "max-w-[90%] bg-neutral-900 text-neutral-100"
                    : "ml-auto max-w-[85%] bg-blue-600 text-white"
                }`}
              >
                {isStreamingEmpty ? "Vantage sta scrivendo…" : m.content}
              </div>
            );
          })}
          {error && (
            <div className="rounded-2xl border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="border-t border-neutral-800 px-6 py-4">
        <div className="flex gap-2">
          <textarea
            className="flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-600"
            rows={2}
            placeholder="Rispondi a Vantage…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send("interview");
              }
            }}
          />
          <button
            onClick={() => send("interview")}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Invia
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-neutral-500">
            Fase 1-2: intervista e filtraggio (Sonnet 5). Turni utente: {userTurns}
          </p>
          <button
            onClick={() => send("blueprint", BLUEPRINT_TRIGGER)}
            disabled={loading || userTurns === 0}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-30"
          >
            Genera Scheda MVP (Opus)
          </button>
        </div>
      </footer>
    </div>
  );
}
