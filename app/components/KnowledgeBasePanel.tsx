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
  domain_expert: "Domain Expert",
  mvp_designer: "MVP Designer",
  stakeholder: "Stakeholder",
};

export function KnowledgeBasePage({ onChanged }: { onChanged?: () => void }) {
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
      onChanged?.();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!res.ok) throw new Error(data?.error ?? "Errore nell'avvio del processo.");
      await loadLatestJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <p className="eyebrow">Knowledge Base</p>
        <h1 className="font-display mt-1.5 text-3xl font-bold tracking-tight">Ambiti e ruoli</h1>
        <p className="mt-2 max-w-2xl text-[0.9rem] text-muted">
          Per ogni ambito, Vantage costruisce tre ruoli riutilizzabili — Domain Expert, MVP Designer e
          Stakeholder — a partire da ricerca web reale.
        </p>

        <div className="mt-6 flex gap-1 rounded-lg border border-line bg-surface p-1">
          <button
            onClick={() => setTab("domains")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "domains"
                ? "bg-[color-mix(in_srgb,var(--brand-bright)_20%,transparent)] text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            Ambiti
          </button>
          <button
            onClick={() => setTab("auto")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "auto"
                ? "bg-[color-mix(in_srgb,var(--brand-bright)_20%,transparent)] text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            Espansione autonoma
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        {tab === "domains" && (
          <div className="mt-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="Es: fisioterapia freelance, growth marketing SaaS B2B…"
                className="v-input flex-1"
                onKeyDown={(e) => e.key === "Enter" && expand()}
              />
              <button onClick={expand} disabled={expanding || !newDomain.trim()} className="v-cta sm:w-auto sm:px-5">
                {expanding ? "Ricerco…" : "Espandi"}
              </button>
            </div>

            {domains === null ? (
              <p className="mt-4 text-xs text-muted">Carico…</p>
            ) : domains.length === 0 ? (
              <p className="mt-4 text-xs text-muted">
                Nessun ambito ancora nella knowledge base. Scrivine uno sopra per generarlo.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {domains.map((d) => (
                  <li key={d.id} className="v-card overflow-hidden">
                    <button
                      onClick={() => setOpenDomainId(openDomainId === d.id ? null : d.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
                    >
                      <span className="truncate font-medium">{d.name}</span>
                      <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[0.68rem] text-muted">
                        {d.personas.length} ruoli
                      </span>
                    </button>
                    {openDomainId === d.id && (
                      <div className="border-t border-line px-4 py-3 text-xs">
                        <p className="mb-2.5 text-muted">{d.description}</p>
                        <div className="flex flex-col gap-1.5">
                          {d.personas.map((p) => (
                            <div key={p.id}>
                              <span className="font-doc text-[0.7rem] tracking-wide text-gold uppercase">
                                {ROLE_LABEL[p.role] ?? p.role}
                              </span>
                              <span className="ml-2 text-muted">{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "auto" && (
          <div className="mt-5 flex flex-col gap-4">
            <p className="text-[0.85rem] text-muted">
              Vantage passa il tempo indicato a ricercare e aggiungere ambiti alla knowledge base da solo, un
              ambito alla volta, senza bisogno di restare con l&apos;app aperta.
            </p>

            {activeJob?.status === "running" ? (
              <div className="v-card p-4">
                <p className="font-display text-sm font-semibold text-gold">
                  In corso —{" "}
                  {activeJob.mode === "domain" ? `ambito: ${activeJob.domain}` : "bisogni emergenti generali"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Scade alle {new Date(activeJob.endsAt).toLocaleTimeString("it-IT")} ·{" "}
                  {activeJob.domainsProcessed.length} ambiti processati finora.
                </p>
                <div className="font-doc mt-3 max-h-40 overflow-y-auto rounded-lg border border-line bg-[var(--bg-deep)] p-2.5 text-[0.7rem] text-muted">
                  {activeJob.log.slice(-15).map((l, i) => (
                    <div key={i}>{l.message}</div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => setScheduleMode("general")}
                    className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      scheduleMode === "general"
                        ? "border-[var(--brand-bright)] bg-[color-mix(in_srgb,var(--brand-bright)_14%,transparent)]"
                        : "border-line text-muted hover:border-line-strong"
                    }`}
                  >
                    Bisogni emergenti generali
                  </button>
                  <button
                    onClick={() => setScheduleMode("domain")}
                    className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      scheduleMode === "domain"
                        ? "border-[var(--brand-bright)] bg-[color-mix(in_srgb,var(--brand-bright)_14%,transparent)]"
                        : "border-line text-muted hover:border-line-strong"
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
                    className="v-input"
                  />
                )}

                <div className="flex items-center gap-3">
                  <label htmlFor="kb-minutes" className="text-sm text-muted">
                    Durata (minuti)
                  </label>
                  <input
                    id="kb-minutes"
                    type="number"
                    min={5}
                    max={240}
                    value={scheduleMinutes}
                    onChange={(e) => setScheduleMinutes(Number(e.target.value))}
                    className="v-input w-24"
                  />
                </div>

                <button
                  onClick={startSchedule}
                  disabled={starting || (scheduleMode === "domain" && !scheduleDomain.trim())}
                  className="v-cta sm:w-auto sm:self-start sm:px-6"
                >
                  {starting ? "Avvio…" : "Avvia espansione autonoma"}
                </button>
              </>
            )}

            {activeJob && activeJob.status !== "running" && (
              <div className="rounded-lg border border-line px-4 py-3 text-xs text-muted">
                Ultimo processo ({activeJob.status === "done" ? "completato" : "interrotto"}):{" "}
                {activeJob.domainsProcessed.length} ambiti aggiunti.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
