"use client";

import { useRef, useState } from "react";

type Attachment = { filename: string; text: string };

const ACCEPT = ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx";

export function FileAttach({
  attachment,
  onChange,
  label = "Allega file (PDF, Word, Excel, CSV, TXT)",
  compact = false,
}: {
  attachment: Attachment | null;
  onChange: (a: Attachment | null) => void;
  label?: string;
  /** Solo l'icona a graffetta: per stare dentro la barra di scrittura. */
  compact?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Errore durante la lettura del file.");
      onChange({ filename: data.filename, text: data.text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto.");
    } finally {
      setUploading(false);
    }
  }

  if (compact) {
    return (
      <span className="relative shrink-0">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {error && (
          <span className="animate-fade-in v-panel absolute bottom-full right-0 mb-2 w-max max-w-56 rounded-lg px-2.5 py-1.5 text-[0.7rem] text-red-400 shadow-lg">
            {error}
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors disabled:opacity-40 ${
            attachment
              ? "border-[color-mix(in_srgb,var(--gold)_45%,transparent)] text-gold"
              : "border-line text-muted hover:border-line-strong hover:text-ink"
          }`}
          title={
            uploading
              ? "Leggo il file…"
              : attachment
                ? `Allegato: ${attachment.filename}`
                : "Allega un documento (PDF, Word, Excel, CSV, TXT)"
          }
          aria-label="Allega un documento"
        >
          {uploading ? (
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--brand-bright)]" />
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5" />
            </svg>
          )}
        </button>
      </span>
    );
  }

  if (attachment) {
    return (
      <div className="animate-fade-in flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-xs">
        <span className="text-gold">◆</span>
        <span className="truncate">{attachment.filename}</span>
        <button
          onClick={() => {
            onChange(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="ml-auto shrink-0 text-muted transition-colors hover:text-ink"
        >
          Rimuovi
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full rounded-lg border border-dashed border-line-strong px-3.5 py-2.5 text-xs text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-50"
      >
        {uploading ? "Leggo il file…" : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export type { Attachment };
