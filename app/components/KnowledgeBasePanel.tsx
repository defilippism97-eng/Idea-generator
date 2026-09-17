"use client";

import { useEffect, useRef, useState } from "react";

type Persona = { id: string; role: string; name: string; systemPrompt: string };
type Domain = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  personas: Persona[];
};

type Job = {
  id: string;
  mode: string;
  domain: string | null;
  status: "running" | "done" | "error";
  startedAt: string;
  endsAt: string;
  log: { at: string; message: string }[];
  domainsProcessed: string[];
};

const ROLE_LABEL: Record<string, string> = {
  domain_expert: "🎓 Domain Expert",
  mvp_designer: "🎨 MVP Designer",
  stakeholder: "🧑‍💼 Stakeholder",
};

export function KnowledgeBasePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"domains" | "auto">("domains");
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDomainId, setOpenDomainId] = useState<string | null>(null);

  const [scheduleMode, setScheduleMode] = useState<"domain" | "general">("general");
  const [scheduleDomain, setScheduleDomain] = useState("");
  const [scheduleMinutes, setScheduleMinutes] = useState(30);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/kb");
      const data = await res.json();
      setDomains(data.domains ?? []);
    } catch {
      setDomains([]);
    }
  }

  async function loadLatestJob() {
    try {
      const res = await fetch("/api/kb/schedule");
      const data = await res.json();
      const jobs: Job[] = data.jobs ?? [];
      const running = jobs.find((j) => j.status === "running");
      setActiveJob(running ?? jobs[0] ?? null);
    } catch {
      // ignora: la lista job è solo informativa
    }
  }

  useEffect(() => {
    load();
    loadLatestJob();
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (activeJob?.status === "running") {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/kb/schedule/${activeJob.id}`);
          const data = await res.json();
          if (data.job) setActiveJob(data.job);
          if (data.job?.status !== "running") load();
        } catch {
          // ignora un singolo poll fallito
        }
      }, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeJob?.id, activeJob?.status]);

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

  async function startSchedule() {
    if (starting || (scheduleMode === "domain" && !scheduleDomain.trim())) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/kb/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: scheduleMode,
          domain: scheduleMode === "domain" ? scheduleDomain.trim() : undefined,
          durationMinutes: scheduleMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Errore nell'avvio del job.");
      await loadLatestJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="animate-fade-in absolute inset-x-0 top-16 z-20 mx-auto max-w-3xl border-b border-white/10 bg-[var(--background-elevated)]/95 px-6 py-4 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold">
          Knowledge Base — Domain Expert / MVP Designer / Stakeholder
        </h2>
        <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
          Chiudi ✕
        </button>
      </div>

      <div className="mb-4 flex gap-1 border-b border-white/10">
        <button
          onClick={() => setTab("domains")}
          className={`px-3 py-2 text-xs font-medium ${tab === "domains" ? "border-b-2 border-indigo-500 text-indigo-300" : "text-neutral-500"}`}
        >
          Domini
        </button>
        <button
          onClick={() => setTab("auto")}
          className={`px-3 py-2 text-xs font-medium ${tab === "auto" ? "border-b-2 border-indigo-500 text-indigo-300" : "text-neutral-500"}`}
        >
          ⏱️ Espansione Autonoma
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {tab === "domains" && (
        <>
          <div className="mb-4 flex gap-2">
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="Es: fisioterapia freelance, growth marketing SaaS B2B…"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs outline-none focus:border-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && expand()}
            />
            <button
              onClick={expand}
              disabled={expanding || !newDomain.trim()}
              className="rounded-lg border border-indigo-500/25 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-500/15 disabled:opacity-40"
            >
              {expanding ? "Ricerco…" : "🔍 Espandi KB"}
            </button>
          </div>

          {domains === null ? (
            <p className="text-xs text-neutral-500">Carico…</p>
          ) : domains.length === 0 ? (
            <p className="text-xs text-neutral-500">
              Nessun ambito ancora nella knowledge base. Scrivine uno sopra per generarlo.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {domains.map((d) => (
                <li key={d.id} className="rounded-lg border border-white/10">
                  <button
                    onClick={() => setOpenDomainId(openDomainId === d.id ? null : d.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-white/[0.03]"
                  >
                    <span className="font-medium">{d.name}</span>
                    <span className="text-neutral-500">{d.personas.length} ruoli</span>
                  </button>
                  {openDomainId === d.id && (
                    <div className="border-t border-white/10 px-3 py-2 text-xs text-neutral-300">
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
        </>
      )}

      {tab === "auto" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-neutral-500">
            Vantage passa il tempo indicato a ricercare e aggiungere ambiti alla knowledge base da solo,
            un ambito alla volta, senza bisogno di restare con l&apos;app aperta.
          </p>

          {activeJob?.status === "running" ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3">
              <p className="mb-1 text-xs font-medium text-amber-300">
                🟢 In corso —{" "}
                {activeJob.mode === "domain" ? `ambito: ${activeJob.domain}` : "bisogni emergenti generali"} · scade
                alle {new Date(activeJob.endsAt).toLocaleTimeString("it-IT")}
              </p>
              <p className="mb-2 text-xs text-neutral-400">
                {activeJob.domainsProcessed.length} ambiti processati finora.
              </p>
              <div className="max-h-40 overflow-y-auto rounded bg-black/30 p-2 font-mono text-[11px] text-neutral-400">
                {activeJob.log.slice(-15).map((l, i) => (
                  <div key={i}>{l.message}</div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setScheduleMode("general")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                    scheduleMode === "general"
                      ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                      : "border-white/10 text-neutral-400"
                  }`}
                >
                  Bisogni emergenti generali
                </button>
                <button
                  onClick={() => setScheduleMode("domain")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                    scheduleMode === "domain"
                      ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                      : "border-white/10 text-neutral-400"
                  }`}
                >
                  Ambito specifico
                </button>
              </div>

              {scheduleMode === "domain" && (
                <input
                  value={scheduleDomain}
                  onChange={(e) => setScheduleDomain(e.target.value)}
                  placeholder="Es: consulenza fiscale — Vantage esplorerà le sotto-nicchie"
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs outline-none focus:border-indigo-500"
                />
              )}

              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-400">Durata (minuti):</label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={scheduleMinutes}
                  onChange={(e) => setScheduleMinutes(Number(e.target.value))}
                  className="w-20 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={startSchedule}
                disabled={starting || (scheduleMode === "domain" && !scheduleDomain.trim())}
                className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40"
              >
                {starting ? "Avvio…" : "▶️ Avvia espansione autonoma"}
              </button>
            </>
          )}

          {activeJob && activeJob.status !== "running" && (
            <div className="rounded-lg border border-white/10 p-3 text-xs text-neutral-400">
              Ultimo job ({activeJob.status === "done" ? "completato" : "interrotto"}):{" "}
              {activeJob.domainsProcessed.length} ambiti aggiunti.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
