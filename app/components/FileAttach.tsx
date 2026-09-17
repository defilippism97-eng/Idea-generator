"use client";

import { useRef, useState } from "react";

type Attachment = { filename: string; text: string };

export function FileAttach({
  attachment,
  onChange,
  label = "Allega file (PDF, Word, Excel, CSV, TXT)",
}: {
  attachment: Attachment | null;
  onChange: (a: Attachment | null) => void;
  label?: string;
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
        accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx"
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
