"use client";

import { useState } from "react";
import { Attachment, FileAttach } from "./FileAttach";
import { Logo } from "./Logo";

type Step = "has-idea" | "idea-input" | "objective" | "scope-choice" | "scope-input";

function withAttachment(text: string, attachment: Attachment | null): string {
  if (!attachment) return text;
  // Evitare riferimenti "a file" (es. "[Allegato: nome.pdf]"): alcuni modelli
  // li interpretano come un invito a invocare un tool di lettura file
  // inesistente invece di leggere il testo già estratto qui sotto.
  return `${text}\n\n--- Informazioni aggiuntive fornite dall'utente ---\n${attachment.text}\n--- fine informazioni aggiuntive ---`;
}

function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-950/40 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-neutral-200 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-40"
    >
      {children}
    </button>
  );
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

  const inputClass =
    "resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm outline-none transition-colors placeholder:text-neutral-500 focus:border-indigo-500/50 focus:bg-white/[0.05]";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-6 py-10">
      {step === "has-idea" && (
        <div className="animate-fade-in-up mb-2 flex flex-col items-center gap-3 text-center">
          <Logo size={48} />
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Da idea a <span className="animate-shimmer bg-clip-text text-transparent">MVP</span>
          </h1>
          <p className="max-w-sm text-sm text-neutral-400">
            Vantage profila la tua idea, la stress-testa e ti consegna un prompt pronto per l&apos;AI di coding.
          </p>
        </div>
      )}

      <div className="animate-fade-in-up flex flex-col gap-5">
        {step === "has-idea" && (
          <>
            <div className="text-center">
              <h2 className="font-display text-base font-semibold">Hai già un&apos;idea da cui partire?</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Puoi scriverla direttamente, o allegare un documento (PDF, Word, Excel/CSV, TXT).
              </p>
            </div>
            <div className="flex gap-2">
              <PrimaryButton onClick={() => setStep("idea-input")} className="flex-1">
                Sì, ho un&apos;idea
              </PrimaryButton>
              <SecondaryButton onClick={() => setStep("objective")} className="flex-1">
                No, non ancora
              </SecondaryButton>
            </div>
          </>
        )}

        {step === "idea-input" && (
          <>
            <div>
              <h2 className="font-display text-base font-semibold">Raccontami la tua idea</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Anche solo poche righe bastano — puoi aggiungere dettagli dopo.
              </p>
            </div>
            <textarea
              className={`min-h-32 ${inputClass}`}
              placeholder="Es: Vorrei un'app che..."
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              autoFocus
            />
            <FileAttach attachment={ideaAttachment} onChange={setIdeaAttachment} />
            <div className="flex gap-2">
              <button
                onClick={() => setStep("has-idea")}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-400 transition-colors hover:bg-white/5"
              >
                ← Indietro
              </button>
              <PrimaryButton onClick={submitIdea} disabled={loading || !ideaText.trim()} className="flex-1 !py-2">
                Continua
              </PrimaryButton>
            </div>
          </>
        )}

        {step === "objective" && (
          <>
            <div className="text-center">
              <h2 className="font-display text-base font-semibold">Che tipo di idea stai cercando?</h2>
            </div>
            <div className="flex gap-2">
              <SecondaryButton
                onClick={() => {
                  setObjective("tempo");
                  setStep("scope-choice");
                }}
                className="flex-1 !py-4"
              >
                ⏱️ Risparmiare tempo
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  setObjective("profitto");
                  setStep("scope-choice");
                }}
                className="flex-1 !py-4"
              >
                💰 Generare profitto
              </SecondaryButton>
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
            <div className="text-center">
              <h2 className="font-display text-base font-semibold">Hai già in mente un ambito di riferimento?</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Es. il tuo ruolo, la tua expertise, il tuo settore — o un CV/annuncio di lavoro da allegare.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <PrimaryButton onClick={() => setStep("scope-input")}>Sì, ce l&apos;ho</PrimaryButton>
              <SecondaryButton onClick={submitScopeRandom} disabled={loading}>
                No, sorprendimi con un ambito casuale
              </SecondaryButton>
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
              <h2 className="font-display text-base font-semibold">Descrivi il tuo ambito</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Ruolo, settore, expertise — oppure allega un CV o un annuncio di lavoro.
              </p>
            </div>
            <textarea
              className={`min-h-28 ${inputClass}`}
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
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-400 transition-colors hover:bg-white/5"
              >
                ← Indietro
              </button>
              <PrimaryButton
                onClick={submitScopeKnown}
                disabled={loading || (!scopeText.trim() && !scopeAttachment)}
                className="flex-1 !py-2"
              >
                Continua
              </PrimaryButton>
            </div>
          </>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <button onClick={onSkip} className="text-xs text-neutral-500 underline hover:text-neutral-300">
          Salta, preferisco scrivere liberamente
        </button>
        <button
          onClick={onFeelingLucky}
          disabled={loading}
          className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/15 disabled:opacity-30"
        >
          🍀 Mi sento fortunato
        </button>
      </div>
    </div>
  );
}
