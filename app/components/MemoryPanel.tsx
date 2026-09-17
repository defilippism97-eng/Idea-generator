"use client";

import { useCallback, useEffect, useState } from "react";
import { Attachment, FileAttach } from "./FileAttach";

export type Memory = {
  id: string;
  title: string;
  content: string;
  source: string;
  active: boolean;
  updatedAt: string;
};

const SOURCE_LABEL: Record<string, string> = {
  cv: "dal CV",
  conversazione: "da una conversazione",
  manuale: "scritto da te",
};

function MemoryRow({
  memory,
  onChanged,
}: {
  memory: Memory;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/memory/${memory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Dimenticare “${memory.title}”?`)) return;
    await fetch(`/api/memory/${memory.id}`, { method: "DELETE" });
    onChanged();
  }

  if (editing) {
    return (
      <li className="v-card p-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="v-input" />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="v-input mt-2 min-h-24 resize-y"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={async () => {
              await patch({ title, content });
              setEditing(false);
            }}
            disabled={busy || !title.trim() || !content.trim()}
            className="v-cta v-cta-sm"
          >
            Salva
          </button>
          <button onClick={() => setEditing(false)} className="v-btn">
            Annulla
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={`v-card p-3 ${memory.active ? "" : "opacity-55"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.88rem] font-medium">{memory.title}</p>
          <p className="mt-1 text-[0.82rem] text-muted">{memory.content}</p>
          <p className="font-doc mt-1.5 text-[0.65rem] tracking-wide text-muted uppercase">
            {SOURCE_LABEL[memory.source] ?? memory.source}
            {!memory.active && " · non usato"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button onClick={() => setEditing(true)} className="v-btn !py-1 !text-[0.7rem]">
            Modifica
          </button>
          <button
            onClick={() => patch({ active: !memory.active })}
            disabled={busy}
            className="v-btn !py-1 !text-[0.7rem]"
          >
            {memory.active ? "Disattiva" : "Attiva"}
          </button>
          <button onClick={remove} className="v-btn !py-1 !text-[0.7rem] !text-red-400">
            Dimentica
          </button>
        </div>
      </div>
    </li>
  );
}

export function MemoryPanel() {
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [profiling, setProfiling] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [cv, setCv] = useState<Attachment | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/memory");
      const data = await res.json();
      setMemories(data.memories ?? []);
    } catch {
      setMemories([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addManual() {
    if (!title.trim() || !content.trim() || adding) return;
    setAdding(true);
    try {
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      setTitle("");
      setContent("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function profileCv(attachment: Attachment) {
    setProfiling(true);
    setNote(null);
    try {
      const res = await fetch("/api/memory/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "cv", text: attachment.text }),
      });
      const data = await res.json();
      const added = data.added?.length ?? 0;
      setNote(
        added > 0
          ? `Ho ricavato ${added} ${added === 1 ? "elemento" : "elementi"} dal tuo CV.`
          : "Non ho trovato nulla di nuovo da aggiungere rispetto a quello che so già.",
      );
      setCv(null);
      await load();
    } catch {
      setNote("Non sono riuscito a leggere il CV. Riprova.");
    } finally {
      setProfiling(false);
    }
  }

  const active = memories?.filter((m) => m.active).length ?? 0;

  return (
    <div className="mt-5 flex flex-col gap-6">
      <section className="v-card p-4">
        <h2 className="font-display text-base font-semibold">Profilati dal tuo CV</h2>
        <p className="mt-1 text-[0.82rem] text-muted">
          Vantage ne ricava ruolo, settore, competenze e strumenti che usi. Il CV non viene conservato: restano
          solo gli elementi qui sotto, che puoi correggere o cancellare.
        </p>
        <div className="mt-3">
          <FileAttach
            attachment={cv}
            onChange={(a) => {
              setCv(a);
              if (a) profileCv(a);
            }}
            label={profiling ? "Analizzo il CV…" : "Carica il tuo CV (PDF, Word, TXT)"}
          />
        </div>
        {note && <p className="mt-2 text-[0.8rem] text-gold">{note}</p>}
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-semibold">
            Cosa so di te {memories ? `(${active} in uso)` : ""}
          </h2>
        </div>
        <p className="mt-1 text-[0.82rem] text-muted">
          Questi elementi vengono passati a Vantage all&apos;inizio di ogni conversazione, così non devi
          ripeterti. Disattivane uno per escluderlo senza cancellarlo.
        </p>

        {memories === null ? (
          <p className="mt-3 text-xs text-muted">Carico…</p>
        ) : memories.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Ancora niente. Carica il tuo CV qui sopra, aggiungi qualcosa a mano, oppure lascia che emerga dalle
            conversazioni: al momento della Sintesi Esecutiva, Vantage salva da solo ciò che hai raccontato di
            stabile su di te.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {memories.map((m) => (
              <MemoryRow key={m.id} memory={m} onChanged={load} />
            ))}
          </ul>
        )}
      </section>

      <section className="v-card p-4">
        <h2 className="font-display text-base font-semibold">Aggiungi a mano</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Etichetta breve — es: Ruolo attuale"
          className="v-input mt-3"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Es: Lavoro come fisioterapista freelance, con studio proprio e circa 40 pazienti attivi."
          className="v-input mt-2 min-h-24 resize-y"
        />
        <button
          onClick={addManual}
          disabled={adding || !title.trim() || !content.trim()}
          className="v-cta v-cta-sm mt-2"
        >
          {adding ? "Salvo…" : "Ricorda"}
        </button>
      </section>
    </div>
  );
}
