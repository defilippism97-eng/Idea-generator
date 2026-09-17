"use client";

import { useState } from "react";
import { Attachment, FileAttach } from "./FileAttach";

type Step = "has-idea" | "idea-input" | "objective" | "scope-choice" | "scope-input";

function withAttachment(text: string, attachment: Attachment | null): string {
  if (!attachment) return text;
  return `${text}\n\n[Contenuto allegato: ${attachment.filename}]\n${attachment.text}`;
}

export function IntakeWizard({
  onStart,
  onFeelingLucky,
  onSkip,
  loading,
}: {
  onStart: (message: string) => void;
  onFeelingLucky: () => void;
  onSkip: () => void;
  loading: boolean;
}) {
  const [step, setStep] = useState<Step>("has-idea");
  const [ideaText, setIdeaText] = useState("");
  const [ideaAttachment, setIdeaAttachment] = useState<Attachment | null>(null);
  const [objective, setObjective] = useState<"tempo" | "profitto" | null>(null);
  const [scopeText, setScopeText] = useState("");
  const [scopeAttachment, setScopeAttachment] = useState<Attachment | null>(null);

  function submitIdea() {
    const message = withAttachment(ideaText.trim(), ideaAttachment);
    if (!message) return;
    onStart(message);
  }

  function submitScopeKnown() {
    const parts = [
      `Non ho ancora un'idea precisa. Il mio obiettivo è: ${objective === "tempo" ? "risparmiare tempo" : "generare profitto"}.`,
      `Il mio ambito di riferimento (ruolo/expertise/contesto) è:`,
      withAttachment(scopeText.trim(), scopeAttachment),
    ];
    onStart(parts.join("\n\n"));
  }

  function submitScopeRandom() {
    const message = `Non ho ancora un'idea precisa. Il mio obiettivo è: ${objective === "tempo" ? "risparmiare tempo" : "generare profitto"}. Non ho un ambito specifico in mente: sorprendimi tu scegliendo un ambito professionale o di vita quotidiana a caso e interessante, poi procediamo da lì.`;
    onStart(message);
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 px-6 py-10">
      {step === "has-idea" && (
        <>
          <div>
            <h2 className="text-base font-semibold">Hai già un&apos;idea da cui partire?</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Puoi scriverla direttamente, o allegare un documento (PDF, Word, Excel/CSV, TXT).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("idea-input")}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium hover:bg-blue-500"
            >
              Sì, ho un&apos;idea
            </button>
            <button
              onClick={() => setStep("objective")}
              className="flex-1 rounded-xl border border-neutral-700 px-4 py-3 text-sm font-medium hover:bg-neutral-900"
            >
              No, non ancora
            </button>
          </div>
        </>
      )}

      {step === "idea-input" && (
        <>
          <div>
            <h2 className="text-base font-semibold">Raccontami la tua idea</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Anche solo poche righe bastano — puoi aggiungere dettagli dopo.
            </p>
          </div>
          <textarea
            className="min-h-32 resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-600"
            placeholder="Es: Vorrei un'app che..."
            value={ideaText}
            onChange={(e) => setIdeaText(e.target.value)}
            autoFocus
          />
          <FileAttach attachment={ideaAttachment} onChange={setIdeaAttachment} />
          <div className="flex gap-2">
            <button
              onClick={() => setStep("has-idea")}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-900"
            >
              ← Indietro
            </button>
            <button
              onClick={submitIdea}
              disabled={loading || !ideaText.trim()}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Continua
            </button>
          </div>
        </>
      )}

      {step === "objective" && (
        <>
          <div>
            <h2 className="text-base font-semibold">Che tipo di idea stai cercando?</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setObjective("tempo");
                setStep("scope-choice");
              }}
              className="flex-1 rounded-xl border border-neutral-700 px-4 py-4 text-sm font-medium hover:bg-neutral-900"
            >
              ⏱️ Risparmiare tempo
            </button>
            <button
              onClick={() => {
                setObjective("profitto");
                setStep("scope-choice");
              }}
              className="flex-1 rounded-xl border border-neutral-700 px-4 py-4 text-sm font-medium hover:bg-neutral-900"
            >
              💰 Generare profitto
            </button>
          </div>
          <button
            onClick={() => setStep("has-idea")}
            className="self-start text-xs text-neutral-500 hover:text-neutral-300"
          >
            ← Indietro
          </button>
        </>
      )}

      {step === "scope-choice" && (
        <>
          <div>
            <h2 className="text-base font-semibold">Hai già in mente un ambito di riferimento?</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Es. il tuo ruolo, la tua expertise, il tuo settore — o un CV/annuncio di lavoro da allegare.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setStep("scope-input")}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium hover:bg-blue-500"
            >
              Sì, ce l&apos;ho
            </button>
            <button
              onClick={submitScopeRandom}
              disabled={loading}
              className="rounded-xl border border-neutral-700 px-4 py-3 text-sm font-medium hover:bg-neutral-900 disabled:opacity-40"
            >
              No, sorprendimi con un ambito casuale
            </button>
          </div>
          <button
            onClick={() => setStep("objective")}
            className="self-start text-xs text-neutral-500 hover:text-neutral-300"
          >
            ← Indietro
          </button>
        </>
      )}

      {step === "scope-input" && (
        <>
          <div>
            <h2 className="text-base font-semibold">Descrivi il tuo ambito</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Ruolo, settore, expertise — oppure allega un CV o un annuncio di lavoro.
            </p>
          </div>
          <textarea
            className="min-h-28 resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-600"
            placeholder="Es: Sono un fisioterapista freelance..."
            value={scopeText}
            onChange={(e) => setScopeText(e.target.value)}
            autoFocus
          />
          <FileAttach
            attachment={scopeAttachment}
            onChange={setScopeAttachment}
            label="Allega CV / annuncio di lavoro"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setStep("scope-choice")}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-900"
            >
              ← Indietro
            </button>
            <button
              onClick={submitScopeKnown}
              disabled={loading || (!scopeText.trim() && !scopeAttachment)}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Continua
            </button>
          </div>
        </>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-4">
        <button onClick={onSkip} className="text-xs text-neutral-500 underline hover:text-neutral-300">
          Salta, preferisco scrivere liberamente
        </button>
        <button
          onClick={onFeelingLucky}
          disabled={loading}
          className="rounded-lg border border-amber-800 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-950/40 disabled:opacity-30"
        >
          🍀 Mi sento fortunato
        </button>
      </div>
    </div>
  );
}
