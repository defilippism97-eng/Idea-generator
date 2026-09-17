"use client";

import { useEffect, useRef, useState } from "react";
import { IntakeWizard } from "./components/IntakeWizard";
import { KnowledgeBasePanel } from "./components/KnowledgeBasePanel";
import { Logo } from "./components/Logo";
import { Markdown } from "./components/Markdown";
import { FULL_MVP_TRIGGER, SUMMARY_TRIGGER, VANTAGE_GREETING } from "@/lib/vantage";

type Message = {
  role: "user" | "assistant" | "persona" | "stakeholder";
  content: string;
  variant?: "summary" | "full";
};

type KbPersona = { id: string; role: string; name: string; systemPrompt: string };
type MatchedDomain = { id: string; name: string; description: string | null; personas: KbPersona[] };

const ROLE_MARKER_RE = / ROLE:(vantage|persona|summary|full) /;

function parseExploreStream(raw: string): Message[] {
  const parts = raw.split(ROLE_MARKER_RE);
  const result: Message[] = [];
  // parts[0] è testo prima del primo marcatore (vuoto); poi alternano ruolo/testo.
  for (let i = 1; i < parts.length; i += 2) {
    const tag = parts[i] as "vantage" | "persona" | "summary" | "full";
    const content = parts[i + 1] ?? "";
    if (tag === "persona") {
      result.push({ role: "persona", content });
    } else {
      result.push({
        role: "assistant",
        content,
        variant: tag === "summary" || tag === "full" ? tag : undefined,
      });
    }
  }
  return result;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard non disponibile (es. contesto non sicuro): ignora silenziosamente.
        }
      }}
      className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-neutral-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
    >
      {copied ? "Copiato ✓" : "Copia prompt"}
    </button>
  );
}

function Avatar({ role }: { role: Message["role"] }) {
  const base = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs";
  if (role === "user") return null;
  if (role === "persona")
    return <div className={`${base} bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30`}>🎭</div>;
  if (role === "stakeholder")
    return <div className={`${base} bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30`}>🧑‍💼</div>;
  return (
    <div className={`${base} bg-gradient-to-br from-indigo-500 to-fuchsia-500 font-display font-semibold text-white`}>
      V
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot h-1.5 w-1.5 rounded-full bg-neutral-400"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

type ArchiveEntry = {
  id: string;
  kind: string;
  title: string | null;
  updatedAt: string;
};

export default function Home() {
  const [phase, setPhase] = useState<"wizard" | "chat">("wizard");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [archiveList, setArchiveList] = useState<ArchiveEntry[] | null>(null);
  const [matchedDomain, setMatchedDomain] = useState<MatchedDomain | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function saveToArchive(finalMessages: Message[], kind: "manual" | "explore") {
    if (finalMessages.length === 0) return;
    try {
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conversationId, kind, messages: finalMessages }),
      });
      const data = await res.json();
      if (res.ok && data.id) setConversationId(data.id);
    } catch {
      // L'archivio è un extra: un fallimento nel salvarlo non deve rompere la chat.
    }
  }

  async function openArchive() {
    setArchiveOpen(true);
    if (archiveList) return;
    try {
      const res = await fetch("/api/archive");
      const data = await res.json();
      setArchiveList(data.conversations ?? []);
    } catch {
      setArchiveList([]);
    }
  }

  async function loadConversation(id: string) {
    try {
      const res = await fetch(`/api/archive/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Impossibile caricare la conversazione.");
      setMessages(data.messages ?? []);
      setConversationId(data.id);
      setPhase("chat");
      setArchiveOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricare la conversazione.");
    }
  }

  function newConversation() {
    setMessages([]);
    setConversationId(null);
    setMatchedDomain(null);
    setPhase("wizard");
    setError(null);
    setArchiveOpen(false);
  }

  async function matchKbDomain(text: string) {
    try {
      const res = await fetch("/api/kb/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setMatchedDomain(data.domain ?? null);
      return data.domain as MatchedDomain | null;
    } catch {
      return null;
    }
  }

  // Prima di generare l'MVP Completo, se l'ambito corrisponde a un dominio
  // già in Knowledge Base, fa parlare lo Stakeholder (il committente/cliente
  // scettico di quel dominio) per una valutazione critica — poi procede.
  async function confirmFullMvp() {
    const stakeholder = matchedDomain?.personas.find((p) => p.role === "stakeholder");
    if (stakeholder) {
      await send(
        "stakeholder",
        `Hai appena letto la Sintesi Esecutiva del progetto qui sopra, nel tuo ruolo di ${stakeholder.name}. Dai una valutazione critica e concreta, in massimo 150 parole: lo approveresti/comprereresti così com'è? Cosa ti convince, cosa ti lascia perplesso o cosa manca?`,
        stakeholder.systemPrompt,
      );
    }
    send("full", FULL_MVP_TRIGGER);
  }

  async function send(
    mode: "interview" | "summary" | "full" | "stakeholder",
    overrideContent?: string,
    systemPrompt?: string,
  ) {
    const content = overrideContent ?? input.trim();
    if (!content || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);
    if (mode !== "interview") setTranscriptOpen(false);

    const resultRole: Message["role"] = mode === "stakeholder" ? "stakeholder" : "assistant";
    const resultVariant = mode === "interview" || mode === "stakeholder" ? undefined : mode;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
          mode,
          systemPrompt,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Errore nella richiesta (HTTP ${res.status}).`);
      }

      setMessages((prev) => [...prev, { role: resultRole, content: "", variant: resultVariant }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      let finalMessages = nextMessages;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        finalMessages = [...nextMessages, { role: resultRole, content: full, variant: resultVariant }];
        setMessages(finalMessages);
      }
      if (mode !== "stakeholder") await saveToArchive(finalMessages, "manual");
      return finalMessages;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Errore sconosciuto. Se la risposta era lunga, potrebbe essere un timeout: riprova.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function runExplore() {
    if (loading) return;
    setPhase("chat");
    setConversationId(null);
    const before: Message[] = [];
    setMessages(before);
    setLoading(true);
    setError(null);
    setTranscriptOpen(false);

    try {
      const res = await fetch("/api/explore", { method: "POST" });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Errore nella richiesta (HTTP ${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let finalMessages: Message[] = before;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        finalMessages = [...before, ...parseExploreStream(raw)];
        setMessages(finalMessages);
      }
      await saveToArchive(finalMessages, "explore");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'esplorazione random.");
    } finally {
      setLoading(false);
    }
  }

  const userTurns = messages.filter((m) => m.role === "user").length;
  const hasSummary = messages.some((m) => m.variant === "summary");
  const hasFull = messages.some((m) => m.variant === "full");

  // Il transcript (intervista/dialettica) è collassabile: una volta pronta la
  // Sintesi Esecutiva o l'MVP Completo, quello che conta è leggere l'esito,
  // non riseguire tutta la conversazione che l'ha prodotto.
  const dialogueMessages = messages.filter((m) => !m.variant && m.role !== "stakeholder");
  const resultMessages = messages.filter((m) => m.variant || m.role === "stakeholder");

  function renderMessage(m: Message, i: number, isLast: boolean) {
    const isStreamingEmpty = loading && isLast && m.role !== "user" && m.content === "";
    const label =
      m.role === "persona"
        ? "Persona simulata (AI)"
        : m.role === "stakeholder"
          ? `${matchedDomain?.personas.find((p) => p.role === "stakeholder")?.name ?? "Stakeholder"} · knowledge base`
          : m.variant === "summary"
            ? "Sintesi Esecutiva"
            : m.variant === "full"
              ? "MVP Completo · prompt per AI di coding"
              : m.role === "assistant"
                ? "Vantage"
                : null;

    const isResultCard = Boolean(m.variant);

    return (
      <div
        key={i}
        className={`animate-fade-in-up flex gap-2.5 ${m.role === "user" ? "ml-auto max-w-[85%] flex-row-reverse" : "max-w-[92%]"} ${isResultCard ? "w-full max-w-full" : ""}`}
      >
        {!isResultCard && <Avatar role={m.role} />}
        <div className="min-w-0 flex-1">
          {label && !isResultCard && (
            <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
              <p
                className={`font-display text-[11px] font-semibold tracking-wide uppercase ${
                  m.role === "persona"
                    ? "text-amber-400"
                    : m.role === "stakeholder"
                      ? "text-violet-400"
                      : "text-neutral-500"
                }`}
              >
                {label}
              </p>
            </div>
          )}
          {isResultCard ? (
            <div
              className={`overflow-hidden rounded-2xl border shadow-lg ${
                m.variant === "full"
                  ? "border-emerald-500/25 bg-emerald-500/[0.04] shadow-emerald-950/20"
                  : "border-indigo-500/25 bg-indigo-500/[0.04] shadow-indigo-950/20"
              }`}
            >
              <div
                className={`h-[3px] w-full bg-gradient-to-r ${
                  m.variant === "full" ? "from-emerald-500 to-teal-400" : "from-indigo-500 to-violet-500"
                }`}
              />
              <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1">
                <p
                  className={`font-display text-xs font-semibold tracking-wide uppercase ${
                    m.variant === "full" ? "text-emerald-300" : "text-indigo-300"
                  }`}
                >
                  {m.variant === "full" ? "✅ " : "📋 "}
                  {label}
                </p>
                {m.variant === "full" && m.content && <CopyButton text={m.content} />}
              </div>
              <div className="px-5 pt-2 pb-5 text-sm leading-relaxed text-neutral-100">
                {isStreamingEmpty ? <TypingIndicator /> : <Markdown text={m.content} />}
              </div>
            </div>
          ) : (
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                m.role === "user"
                  ? "whitespace-pre-wrap bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                  : m.role === "persona"
                    ? "border border-amber-500/20 bg-amber-500/[0.06] text-amber-50"
                    : m.role === "stakeholder"
                      ? "border border-violet-500/20 bg-violet-500/[0.06] text-violet-50"
                      : "border border-white/[0.06] bg-white/[0.03] text-neutral-100"
              }`}
            >
              {isStreamingEmpty ? (
                <TypingIndicator />
              ) : m.role === "user" ? (
                m.content
              ) : (
                <Markdown text={m.content} />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-dvh max-w-3xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-[var(--background)]/80 px-5 py-3.5 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <div>
            <h1 className="font-display text-base font-semibold tracking-tight">Vantage</h1>
            <p className="text-xs text-neutral-400">Da idea a prompt di sviluppo</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1">
          {phase === "chat" && (
            <button
              onClick={newConversation}
              title="Nuova conversazione"
              className="rounded-full px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              + Nuova
            </button>
          )}
          <button
            onClick={openArchive}
            title="Conversazioni salvate"
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            🗂️ Archivio
          </button>
          <button
            onClick={() => setKbOpen(true)}
            title="Knowledge Base"
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            🧠 Knowledge Base
          </button>
        </div>
      </header>

      {kbOpen && <KnowledgeBasePanel onClose={() => setKbOpen(false)} />}

      {archiveOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-40 flex items-start justify-center bg-black/60 px-4 pt-20 backdrop-blur-sm sm:pt-28"
          onClick={() => setArchiveOpen(false)}
        >
          <div
            className="animate-scale-in w-full max-w-md rounded-2xl border border-white/10 bg-[var(--background-elevated)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold">Conversazioni salvate</h2>
              <button
                onClick={() => setArchiveOpen(false)}
                className="rounded-full p-1 text-xs text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-300"
              >
                ✕
              </button>
            </div>
            {archiveList === null ? (
              <p className="text-xs text-neutral-500">Carico…</p>
            ) : archiveList.length === 0 ? (
              <p className="text-xs text-neutral-500">Nessuna conversazione salvata ancora.</p>
            ) : (
              <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
                {archiveList.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => loadConversation(item.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition-colors hover:bg-white/[0.06]"
                    >
                      <span className="truncate">
                        {item.kind === "explore" ? "🎲 " : ""}
                        {item.title || "Senza titolo"}
                      </span>
                      <span className="shrink-0 text-neutral-500">
                        {new Date(item.updatedAt).toLocaleDateString("it-IT")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {phase === "wizard" ? (
        <IntakeWizard
          loading={loading}
          onStart={async (message) => {
            setPhase("chat");
            const domain = await matchKbDomain(message);
            const enriched = domain?.description
              ? `${message}\n\n--- Contesto di dominio verificato (knowledge base) ---\n${domain.description}\n--- fine contesto ---`
              : message;
            send("interview", enriched);
          }}
          onFeelingLucky={runExplore}
          onSkip={() => {
            setMessages([{ role: "assistant", content: VANTAGE_GREETING }]);
            setPhase("chat");
          }}
        />
      ) : (
        <>
          <main className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4">
              {resultMessages.length > 0 ? (
                <>
                  <button
                    onClick={() => setTranscriptOpen((v) => !v)}
                    className="self-start text-xs text-neutral-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-neutral-300"
                  >
                    {transcriptOpen ? "Nascondi" : "Mostra"} la conversazione che ha portato a questo
                    risultato ({dialogueMessages.length} messaggi)
                  </button>
                  {transcriptOpen && (
                    <div className="flex flex-col gap-4 border-l-2 border-white/[0.06] pl-4">
                      {dialogueMessages.map((m, i) => renderMessage(m, i, false))}
                    </div>
                  )}
                  <div className="flex flex-col gap-4">
                    {resultMessages.map((m, i) =>
                      renderMessage(m, i, i === resultMessages.length - 1 && !hasFull),
                    )}
                  </div>
                </>
              ) : (
                dialogueMessages.map((m, i) => renderMessage(m, i, i === dialogueMessages.length - 1))
              )}
              {error && (
                <div className="animate-fade-in-up rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </main>

          <footer className="border-t border-white/[0.06] bg-gradient-to-t from-[var(--background)] to-transparent px-5 py-4 sm:px-6">
            {!hasFull && (
              <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 shadow-lg shadow-black/20 transition-colors focus-within:border-indigo-500/40">
                <textarea
                  className="max-h-40 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-neutral-500"
                  rows={2}
                  placeholder="Scrivi la tua idea, o rispondi a Vantage…"
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-950/50 transition-transform hover:scale-[1.05] active:scale-[0.95] disabled:pointer-events-none disabled:opacity-30"
                  title="Invia"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-neutral-500">Turni: {userTurns}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={runExplore}
                  disabled={loading}
                  title="Simula da zero un'intera conversazione tra Vantage e una persona/idea casuale generata dall'AI"
                  className="rounded-full border border-amber-500/25 bg-amber-500/[0.06] px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/15 disabled:opacity-30"
                >
                  🎲 Esplorazione Random
                </button>
                {!hasSummary && (
                  <button
                    onClick={() => send("summary", SUMMARY_TRIGGER)}
                    disabled={loading || userTurns === 0}
                    className="rounded-full border border-indigo-500/25 bg-indigo-500/[0.06] px-3 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/15 disabled:opacity-30"
                  >
                    📋 Genera Sintesi Esecutiva
                  </button>
                )}
                {hasSummary && !hasFull && (
                  <button
                    onClick={confirmFullMvp}
                    disabled={loading}
                    className="rounded-full border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:opacity-30"
                  >
                    ✅ Sì, voglio l&apos;MVP Completo
                  </button>
                )}
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
