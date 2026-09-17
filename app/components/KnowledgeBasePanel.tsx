"use client";

import { useEffect, useState } from "react";

type Persona = { id: string; role: string; name: string; systemPrompt: string };
type Domain = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  personas: Persona[];
};

const ROLE_LABEL: Record<string, string> = {
  domain_expert: "🎓 Domain Expert",
  mvp_designer: "🎨 MVP Designer",
  stakeholder: "🧑‍💼 Stakeholder",
};

export function KnowledgeBasePanel({ onClose }: { onClose: () => void }) {
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDomainId, setOpenDomainId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/kb");
      const data = await res.json();
      setDomains(data.domains ?? []);
    } catch {
      setDomains([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function expand() {
    const domain = newDomain.trim();
    if (!domain || expanding) return;
    setExpanding(true);
    setError(null);
    try {
      const res = await fetch("/api/kb/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Errore durante l'espansione.");
      setNewDomain("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto.");
    } finally {
      setExpanding(false);
    }
  }

  return (
    <div className="absolute inset-x-0 top-16 z-20 mx-auto max-w-3xl border-b border-neutral-800 bg-neutral-950 px-6 py-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Knowledge Base — Domain Expert / MVP Designer / Stakeholder</h2>
        <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
          Chiudi ✕
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="Es: fisioterapia freelance, growth marketing SaaS B2B…"
          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs outline-none focus:border-blue-600"
          onKeyDown={(e) => e.key === "Enter" && expand()}
        />
        <button
          onClick={expand}
          disabled={expanding || !newDomain.trim()}
          className="rounded-lg border border-blue-800 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-950/40 disabled:opacity-40"
        >
          {expanding ? "Ricerco…" : "🔍 Espandi KB"}
        </button>
      </div>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {domains === null ? (
        <p className="text-xs text-neutral-500">Carico…</p>
      ) : domains.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Nessun ambito ancora nella knowledge base. Scrivine uno sopra per generarlo.
        </p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {domains.map((d) => (
            <li key={d.id} className="rounded-lg border border-neutral-800">
              <button
                onClick={() => setOpenDomainId(openDomainId === d.id ? null : d.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-neutral-900"
              >
                <span className="font-medium">{d.name}</span>
                <span className="text-neutral-500">{d.personas.length} ruoli</span>
              </button>
              {openDomainId === d.id && (
                <div className="border-t border-neutral-800 px-3 py-2 text-xs text-neutral-300">
                  <p className="mb-2 text-neutral-400">{d.description}</p>
                  {d.personas.map((p) => (
                    <div key={p.id} className="mb-1">
                      <span className="font-medium">{ROLE_LABEL[p.role] ?? p.role}</span>: {p.name}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
