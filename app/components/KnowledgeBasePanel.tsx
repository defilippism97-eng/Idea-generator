"use client";

import { useEffect, useRef, useState } from "react";
import { Attachment, FileAttach } from "./FileAttach";
import { MemoryPanel } from "./MemoryPanel";

type Source = { n: number; title: string; url: string };
type Persona = { id: string; role: string; name: string; systemPrompt: string };
type KbDoc = { id: string; title: string; createdAt: string };

type Domain = {
  id: string;
  name: string;
  description: string | null;
  sources: Source[] | null;
  origin: string;
  updatedAt: string;
  personas: Persona[];
  documents: KbDoc[];
};

type Job = {
  id: string;
  mode: string;
  domain: string | null;
  status: "running" | "done" | "error" | "stopped";
  cancelRequested: boolean;
  startedAt: string;
  endsAt: string;
  log: { at: string; message: string }[];
  domainsProcessed: string[];
};

const ROLES = [
  {
    id: "domain_expert",
    label: "Domain Expert",
    hint: "Conosce il settore: termini, strumenti in uso, normative, problemi reali.",
  },
  {
    id: "mvp_designer",
    label: "MVP Designer",
    hint: "Sa quali prodotti funzionano in questo settore e perché altri falliscono.",
  },
  {
    id: "stakeholder",
    label: "Stakeholder",
    hint: "Il committente scettico che deve approvare o comprare l'idea.",
  },
] as const;

/** Rende i riferimenti [n] come note cliccabili verso la fonte corrispondente. */
function WithCitations({ text, sources }: { text: string; sources: Source[] }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        const source = match ? sources.find((s) => s.n === Number(match[1])) : undefined;
        if (!source) return <span key={i}>{part}</span>;
        return (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.title}
            className="citation"
          >
            {source.n}
          </a>
        );
      })}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="font-doc text-[0.68rem] tracking-wider text-gold uppercase">{children}</h4>
  );
}

function RoleEditor({
  domainId,
  role,
  persona,
  onSaved,
}: {
  domainId: string;
  role: (typeof ROLES)[number];
  persona?: Persona;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(persona?.name ?? "");
  const [prompt, setPrompt] = useState(persona?.systemPrompt ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !prompt.trim() || saving) return;
    setSaving(true);
    try {
      if (persona) {
        await fetch(`/api/kb/personas/${persona.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, systemPrompt: prompt }),
        });
      } else {
        await fetch(`/api/kb/domains/${domainId}/personas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: role.id, name, systemPrompt: prompt }),
        });
      }
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-line-strong p-3">
        <SectionTitle>{role.label}</SectionTitle>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome del ruolo (es. Esperto di fisioterapia sportiva)"
          className="v-input mt-2"
        />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Istruzioni del ruolo, in seconda persona: «Sei un…»"
          className="v-input mt-2 min-h-32 resize-y"
        />
        <div className="mt-2 flex gap-2">
          <button onClick={save} disabled={saving || !name.trim() || !prompt.trim()} className="v-cta v-cta-sm">
            {saving ? "Salvo…" : "Salva ruolo"}
          </button>
          <button onClick={() => setEditing(false)} className="v-btn">
            Annulla
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionTitle>{role.label}</SectionTitle>
          {persona ? (
            <p className="mt-1 text-[0.85rem]">{persona.name}</p>
          ) : (
            <p className="mt-1 text-[0.8rem] text-muted">Non ancora compilato — {role.hint}</p>
          )}
        </div>
        <button
          onClick={() => {
            setName(persona?.name ?? "");
            setPrompt(persona?.systemPrompt ?? "");
            setEditing(true);
          }}
          className="v-btn shrink-0"
        >
          {persona ? "Modifica" : "Compila"}
        </button>
      </div>
      {persona && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[0.75rem] text-muted hover:text-ink">
            Vedi le istruzioni
          </summary>
          <p className="mt-2 text-[0.8rem] whitespace-pre-wrap text-muted">{persona.systemPrompt}</p>
        </details>
      )}
    </div>
  );
}

function DomainDetail({ domain, onChanged }: { domain: Domain; onChanged: () => void }) {
  const [name, setName] = useState(domain.name);
  const [description, setDescription] = useState(domain.description ?? "");
  const [editingText, setEditingText] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  // Gli ambiti creati prima della numerazione hanno fonti senza "n": si
  // numerano in ordine, così i riferimenti restano coerenti.
  const sources = (domain.sources ?? []).map((s, i) => ({ ...s, n: s.n ?? i + 1 }));

  async function saveMeta() {
    setBusy(true);
    try {
      await fetch(`/api/kb/domains/${domain.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      setEditingText(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function addDocument(a: Attachment) {
    setBusy(true);
    try {
      await fetch(`/api/kb/domains/${domain.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: a.filename, text: a.text }),
      });
      setAttachment(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(id: string) {
    await fetch(`/api/kb/documents/${id}`, { method: "DELETE" });
    onChanged();
  }

  async function removeDomain() {
    if (!confirm(`Eliminare l'ambito "${domain.name}" con i suoi ruoli e documenti?`)) return;
    await fetch(`/api/kb/domains/${domain.id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="border-t border-line px-4 py-4">
      {editingText ? (
        <div className="flex flex-col gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="v-input" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrizione dell'ambito"
            className="v-input min-h-28 resize-y"
          />
          <div className="flex gap-2">
            <button onClick={saveMeta} disabled={busy} className="v-cta v-cta-sm">
              Salva
            </button>
            <button onClick={() => setEditingText(false)} className="v-btn">
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-[0.85rem] leading-relaxed text-muted">
              {domain.description ? (
                <WithCitations text={domain.description} sources={sources} />
              ) : (
                "Nessuna descrizione."
              )}
            </p>
            <button onClick={() => setEditingText(true)} className="v-btn shrink-0">
              Modifica
            </button>
          </div>

          {sources.length > 0 && (
            <div className="mt-3">
              <SectionTitle>Fonti</SectionTitle>
              <ol className="mt-1.5 flex flex-col gap-1">
                {sources.map((s) => (
                  <li key={s.n} className="flex gap-2 text-[0.75rem]">
                    <span className="font-doc shrink-0 text-muted">[{s.n}]</span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-brand-bright hover:underline"
                    >
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <SectionTitle>Ruoli</SectionTitle>
        {ROLES.map((role) => (
          <RoleEditor
            key={role.id}
            domainId={domain.id}
            role={role}
            persona={domain.personas.find((p) => p.role === role.id)}
            onSaved={onChanged}
          />
        ))}
      </div>

      <div className="mt-4">
        <SectionTitle>Materiale caricato</SectionTitle>
        {domain.documents.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {domain.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[0.8rem]"
              >
                <span className="text-gold">◆</span>
                <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                <button
                  onClick={() => removeDocument(doc.id)}
                  className="shrink-0 text-[0.72rem] text-muted transition-colors hover:text-red-400"
                >
                  Elimina
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[0.75rem] text-muted">
          Aggiungi una knowledge base di settore, un&apos;analisi di mercato o i tuoi appunti: Vantage li userà
          come contesto quando la conversazione riguarda questo ambito.
        </p>
        <div className="mt-2">
          <FileAttach
            attachment={attachment}
            onChange={(a) => {
              setAttachment(a);
              if (a) addDocument(a);
            }}
            label="Carica un documento (PDF, Word, Excel, CSV, TXT)"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end border-t border-line pt-3">
        <button onClick={removeDomain} className="v-btn !text-red-400">
          Elimina ambito
        </button>
      </div>
    </div>
  );
}

export function KnowledgeBasePage({ onChanged }: { onChanged?: () => void }) {
  const [tab, setTab] = useState<"ambiti" | "espansione" | "profilo">("ambiti");
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDomainId, setOpenDomainId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [manualName, setManualName] = useState("");

  const [researchTopic, setResearchTopic] = useState("");
  const [researching, setResearching] = useState(false);

  const [scheduleMode, setScheduleMode] = useState<"domain" | "general">("general");
  const [scheduleDomain, setScheduleDomain] = useState("");
  const [scheduleMinutes, setScheduleMinutes] = useState(30);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
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
      setActiveJob(jobs.find((j) => j.status === "running") ?? jobs[0] ?? null);
    } catch {
      // la lista dei processi è solo informativa
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
          // un singolo poll fallito non è un problema
        }
      }, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob?.id, activeJob?.status]);

  async function createManual() {
    const name = manualName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/kb/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Impossibile creare l'ambito.");
      setManualName("");
      await load();
      setOpenDomainId(data.id);
      setTab("ambiti");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto.");
    } finally {
      setCreating(false);
    }
  }

  async function research() {
    const domain = researchTopic.trim();
    if (!domain || researching) return;
    setResearching(true);
    setError(null);
    try {
      const res = await fetch("/api/kb/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Errore durante la ricerca.");
      setResearchTopic("");
      await load();
      setTab("ambiti");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto.");
    } finally {
      setResearching(false);
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

  async function stopSchedule() {
    if (!activeJob || stopping) return;
    setStopping(true);
    try {
      await fetch(`/api/kb/schedule/${activeJob.id}`, { method: "PATCH" });
      await loadLatestJob();
    } finally {
      setStopping(false);
    }
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-[color-mix(in_srgb,var(--brand-bright)_20%,transparent)] text-ink"
        : "text-muted hover:text-ink"
    }`;

  return (
    <div className="px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <p className="eyebrow">Knowledge Base</p>
        <h1 className="font-display mt-1.5 text-3xl font-bold tracking-tight">Ambiti e ruoli</h1>
        <p className="mt-2 max-w-2xl text-[0.9rem] text-muted">
          Un ambito raccoglie quello che Vantage sa su un settore: una descrizione con le sue fonti, tre ruoli
          riutilizzabili e il materiale che carichi tu. Viene richiamato quando una conversazione tocca quel tema.
        </p>

        <div className="mt-6 flex gap-1 rounded-lg border border-line bg-surface p-1">
          <button onClick={() => setTab("ambiti")} className={tabClass(tab === "ambiti")}>
            Ambiti {domains ? `(${domains.length})` : ""}
          </button>
          <button onClick={() => setTab("espansione")} className={tabClass(tab === "espansione")}>
            Come si popola
          </button>
          <button onClick={() => setTab("profilo")} className={tabClass(tab === "profilo")}>
            Il tuo profilo
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        {tab === "ambiti" && (
          <div className="mt-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Crea un ambito vuoto da compilare tu — es: consulenza fiscale PMI"
                className="v-input flex-1"
                onKeyDown={(e) => e.key === "Enter" && createManual()}
              />
              <button onClick={createManual} disabled={creating || !manualName.trim()} className="v-cta shrink-0 px-5">
                {creating ? "Creo…" : "Crea"}
              </button>
            </div>

            {domains === null ? (
              <p className="mt-4 text-xs text-muted">Carico…</p>
            ) : domains.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                Nessun ambito ancora. Creane uno qui sopra e compilalo tu, oppure vai su “Come si popola” per
                farlo costruire a Vantage con una ricerca.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {domains.map((d) => (
                  <li key={d.id} className="v-card overflow-hidden">
                    <button
                      onClick={() => setOpenDomainId(openDomainId === d.id ? null : d.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{d.name}</span>
                        <span className="mt-0.5 block text-[0.72rem] text-muted">
                          {d.origin === "manuale" ? "creato a mano" : "da ricerca"} ·{" "}
                          {d.personas.length}/3 ruoli
                          {d.documents.length > 0 && ` · ${d.documents.length} doc.`}
                          {d.sources?.length ? ` · ${d.sources.length} fonti` : " · nessuna fonte"}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted">{openDomainId === d.id ? "−" : "+"}</span>
                    </button>
                    {openDomainId === d.id && <DomainDetail domain={d} onChanged={load} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "profilo" && <MemoryPanel />}

        {tab === "espansione" && (
          <div className="mt-5 flex flex-col gap-6">
            <section className="v-card p-4">
              <h2 className="font-display text-base font-semibold">Ricerca su un ambito</h2>
              <p className="mt-1 text-[0.82rem] text-muted">
                Vantage cerca sul web informazioni reali sull&apos;ambito che indichi, poi ne ricava la
                descrizione — con i riferimenti alle fonti — e i tre ruoli. Richiede circa un minuto.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={researchTopic}
                  onChange={(e) => setResearchTopic(e.target.value)}
                  placeholder="Es: fisioterapia freelance, growth marketing SaaS B2B…"
                  className="v-input flex-1"
                  onKeyDown={(e) => e.key === "Enter" && research()}
                />
                <button
                  onClick={research}
                  disabled={researching || !researchTopic.trim()}
                  className="v-cta shrink-0 px-5"
                >
                  {researching ? "Ricerco…" : "Cerca e crea"}
                </button>
              </div>
            </section>

            <section className="v-card p-4">
              <h2 className="font-display text-base font-semibold">Espansione autonoma</h2>
              <p className="mt-1 text-[0.82rem] text-muted">
                Per il tempo che indichi, Vantage continua da solo: sceglie un ambito alla volta, lo ricerca e lo
                aggiunge. Puoi indirizzarlo su un settore o lasciarlo esplorare bisogni emergenti in generale. Non
                serve tenere l&apos;app aperta.
              </p>

              {activeJob?.status === "running" ? (
                <div className="mt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-sm font-semibold text-gold">
                        In corso —{" "}
                        {activeJob.mode === "domain"
                          ? `ambito: ${activeJob.domain}`
                          : "bisogni emergenti generali"}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {activeJob.cancelRequested
                          ? "Arresto richiesto: termino l'ambito in corso e poi mi fermo (può richiedere un minuto)."
                          : `Scade alle ${new Date(activeJob.endsAt).toLocaleTimeString("it-IT")} · ${activeJob.domainsProcessed.length} ambiti aggiunti finora.`}
                      </p>
                    </div>
                    <button
                      onClick={stopSchedule}
                      disabled={stopping || activeJob.cancelRequested}
                      className="v-btn shrink-0 !text-red-400"
                    >
                      {activeJob.cancelRequested ? "Mi fermo…" : stopping ? "Fermo…" : "Ferma"}
                    </button>
                  </div>
                  <div className="font-doc mt-3 max-h-48 overflow-y-auto rounded-lg border border-line bg-[var(--bg-deep)] p-2.5 text-[0.7rem] text-muted">
                    {activeJob.log.slice(-20).map((l, i) => (
                      <div key={i}>{l.message}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
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
                      Settore specifico
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
                    <label htmlFor="kb-minutes" className="shrink-0 text-sm text-muted">
                      Per quanti minuti
                    </label>
                    <input
                      id="kb-minutes"
                      type="number"
                      min={5}
                      max={240}
                      value={scheduleMinutes}
                      onChange={(e) => setScheduleMinutes(Number(e.target.value))}
                      className="v-input !w-24"
                    />
                  </div>

                  <button
                    onClick={startSchedule}
                    disabled={starting || (scheduleMode === "domain" && !scheduleDomain.trim())}
                    className="v-cta self-start px-6"
                  >
                    {starting ? "Avvio…" : "Avvia"}
                  </button>

                  {activeJob && (
                    <p className="text-xs text-muted">
                      Ultimo processo:{" "}
                      {activeJob.status === "done"
                        ? "completato"
                        : activeJob.status === "stopped"
                          ? "fermato"
                          : "interrotto da un errore"}
                      , {activeJob.domainsProcessed.length} ambiti aggiunti.
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
