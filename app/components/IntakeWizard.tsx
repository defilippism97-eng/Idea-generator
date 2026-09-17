"use client";

import { useRef, useState } from "react";
import { Attachment, FileAttach } from "./FileAttach";
import { VoiceInput } from "./VoiceInput";

type Step = "has-idea" | "idea-input" | "objective" | "scope-choice" | "scope-input";

function withAttachment(text: string, attachment: Attachment | null): string {
  if (!attachment) return text;
  // Evitare riferimenti "a file" (es. "[Allegato: nome.pdf]"): alcuni modelli
  // li interpretano come un invito a invocare un tool di lettura file
  // inesistente invece di leggere il testo già estratto qui sotto.
  return `${text}\n\n--- Informazioni aggiuntive fornite dall'utente ---\n${attachment.text}\n--- fine informazioni aggiuntive ---`;
}

const OBJECTIVES = [
  {
    id: "tempo",
    label: "Risparmiare tempo",
    hint: "Togliere attrito e lavoro ripetitivo dalla routine.",
    phrase: "risparmiare tempo",
  },
  {
    id: "profitto",
    label: "Generare profitto",
    hint: "Costruire qualcosa che qualcuno sia disposto a pagare.",
    phrase: "generare profitto",
  },
  {
    id: "impatto",
    label: "Creare impatto",
    hint: "Produrre un beneficio sociale o ambientale misurabile.",
    phrase: "creare un impatto sociale o ambientale",
  },
] as const;

type ObjectiveId = (typeof OBJECTIVES)[number]["id"];

function objectivePhrase(id: ObjectiveId | null): string {
  return OBJECTIVES.find((o) => o.id === id)?.phrase ?? "risparmiare tempo";
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IdeaIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 48 48" aria-hidden="true" className="text-brand-bright">
      <g {...strokeProps}>
        {/* razzo */}
        <path d="M18 12c3.5 4 5 9 5 13v6H13v-6c0-4 1.5-9 5-13Z" />
        <circle cx="18" cy="21" r="2.4" />
        <path d="M13 26.5 9.5 30v4.5l3.5-2.5M23 26.5l3.5 3.5v4.5L23 32" />
        {/* documento */}
        <path d="M28 14h10v24H28" />
        <path d="M31 21h4M31 26h4M31 31h3" />
      </g>
      <path d="M10 11.5q.7 2.4 3.5 3.1-2.8.7-3.5 3.1-.7-2.4-3.5-3.1 2.8-.7 3.5-3.1Z" fill="#D4A757" />
    </svg>
  );
}

function ProblemIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 48 48" aria-hidden="true" className="text-brand-bright">
      <g {...strokeProps}>
        {/* lampadina */}
        <path d="M15.5 26a9 9 0 1 1 11 0c-1.3 1.1-1.9 2.4-2.1 3.9h-6.8c-.2-1.5-.8-2.8-2.1-3.9Z" />
        <path d="M17.5 33h7M19 36.5h4" />
        {/* ingranaggio */}
        <circle cx="35" cy="32" r="4" />
        <path d="M35 25.5v-2.5M35 38.5v2.5M41.5 32h2.5M28.5 32H26M39.6 27.4l1.8-1.8M30.4 36.6l-1.8 1.8M39.6 36.6l1.8 1.8M30.4 27.4l-1.8-1.8" />
      </g>
      <path d="M21 12.5q.7 2.4 3.5 3.1-2.8.7-3.5 3.1-.7-2.4-3.5-3.1 2.8-.7 3.5-3.1Z" fill="#D4A757" />
    </svg>
  );
}

function LuckyIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 48 48" aria-hidden="true" className="text-brand-bright">
      <g {...strokeProps}>
        <rect x="8" y="18" width="21" height="21" rx="4.5" />
        <circle cx="15" cy="25" r="1.7" />
        <circle cx="22" cy="32" r="1.7" />
        <circle cx="15" cy="32" r="1.7" />
        <circle cx="22" cy="25" r="1.7" />
      </g>
      <path d="M35 9q1.6 6 10 7.8-8.4 1.8-10 7.8-1.6-6-10-7.8Q33.4 15 35 9Z" fill="#D4A757" />
    </svg>
  );
}

function EntryCard({
  icon,
  title,
  description,
  cta,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="v-card flex gap-4 p-5 sm:flex-col sm:items-center sm:gap-3 sm:p-6 sm:text-center">
      <div className="flex shrink-0 items-center justify-center">{icon}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:items-center">
        <h3 className="font-display text-lg leading-tight font-semibold">{title}</h3>
        <p className="text-[0.84rem] leading-snug text-muted sm:min-h-[2.6rem]">{description}</p>
        <button onClick={onClick} disabled={disabled} className="v-cta mt-1 w-full">
          {cta}
        </button>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="self-start text-xs text-muted transition-colors hover:text-ink">
      ← Indietro
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
  const [objective, setObjective] = useState<ObjectiveId | null>(null);
  const [scopeText, setScopeText] = useState("");
  const [scopeAttachment, setScopeAttachment] = useState<Attachment | null>(null);
  const dictationBaseRef = useRef("");

  function dictateIdea(text: string, isFinal: boolean) {
    const merged = `${dictationBaseRef.current} ${text}`.trim();
    if (isFinal) dictationBaseRef.current = merged;
    setIdeaText(merged);
  }

  function submitIdea() {
    const message = withAttachment(ideaText.trim(), ideaAttachment);
    if (!message) return;
    onStart(message);
  }

  function submitScopeKnown() {
    const parts = [
      `Non ho ancora un'idea precisa. Il mio obiettivo è: ${objectivePhrase(objective)}.`,
      `Il mio ambito di riferimento (ruolo/expertise/contesto) è:`,
      withAttachment(scopeText.trim(), scopeAttachment),
    ];
    onStart(parts.join("\n\n"));
  }

  function submitScopeRandom() {
    const message = `Non ho ancora un'idea precisa. Il mio obiettivo è: ${objectivePhrase(objective)}. Non ho un ambito specifico in mente: proponimi tu un ambito professionale o di vita quotidiana interessante, spiegandomi in una riga perché lo hai scelto, poi procediamo da lì.`;
    onStart(message);
  }

  if (step === "has-idea") {
    return (
      <div className="animate-fade-in-up grid gap-4 sm:grid-cols-3">
        <EntryCard
          icon={<IdeaIcon />}
          title="Hai già un'idea?"
          description="Inizia a descrivere la tua visione del prodotto."
          cta="Inizia con idea"
          onClick={() => setStep("idea-input")}
        />
        <EntryCard
          icon={<ProblemIcon />}
          title="Esplorazione guidata"
          description="Vantage ti porta all'idea partendo dal tuo obiettivo e dal tuo ambito."
          cta="Esplora con me"
          onClick={() => setStep("objective")}
        />
        <EntryCard
          icon={<LuckyIcon />}
          title="Mi sento fortunato!"
          description="Chiedi a Vantage di generare un concept di MVP casuale."
          cta="Sorprendimi"
          onClick={onFeelingLucky}
          disabled={loading}
        />
        <div className="sm:col-span-3">
          <button
            onClick={onSkip}
            className="text-xs text-muted underline underline-offset-2 transition-colors hover:text-ink"
          >
            Salta, preferisco scrivere liberamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="v-card animate-fade-in-up flex max-w-xl flex-col gap-4 p-5 sm:p-6">
      {step === "idea-input" && (
        <>
          <BackButton onClick={() => setStep("has-idea")} />
          <div>
            <h3 className="font-display text-lg font-semibold">Raccontami la tua idea</h3>
            <p className="mt-1 text-[0.84rem] text-muted">
              Anche solo poche righe bastano — puoi aggiungere dettagli dopo.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <textarea
              className="v-input min-h-32 resize-none"
              placeholder="Es: Vorrei un'app che…"
              value={ideaText}
              onChange={(e) => {
                setIdeaText(e.target.value);
                dictationBaseRef.current = e.target.value;
              }}
              autoFocus
            />
            <VoiceInput onTranscript={dictateIdea} disabled={loading} />
          </div>
          <FileAttach attachment={ideaAttachment} onChange={setIdeaAttachment} />
          <button onClick={submitIdea} disabled={loading || !ideaText.trim()} className="v-cta w-full">
            Continua
          </button>
        </>
      )}

      {step === "objective" && (
        <>
          <BackButton onClick={() => setStep("has-idea")} />
          <h3 className="font-display text-lg font-semibold">Che tipo di idea stai cercando?</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {OBJECTIVES.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setObjective(o.id);
                  setStep("scope-choice");
                }}
                className="v-card px-4 py-5 text-left transition-transform hover:-translate-y-0.5"
              >
                <span className="font-display block text-base font-semibold">{o.label}</span>
                <span className="mt-1 block text-[0.8rem] text-muted">{o.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === "scope-choice" && (
        <>
          <BackButton onClick={() => setStep("objective")} />
          <div>
            <h3 className="font-display text-lg font-semibold">Hai già in mente un ambito di riferimento?</h3>
            <p className="mt-1 text-[0.84rem] text-muted">
              Il tuo ruolo, la tua expertise, il tuo settore — oppure un CV o un annuncio di lavoro da allegare.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <button onClick={() => setStep("scope-input")} className="v-cta w-full">
              Sì, ce l&apos;ho
            </button>
            <button onClick={submitScopeRandom} disabled={loading} className="v-btn justify-center !py-2.5">
              No, scegline uno a caso
            </button>
          </div>
        </>
      )}

      {step === "scope-input" && (
        <>
          <BackButton onClick={() => setStep("scope-choice")} />
          <div>
            <h3 className="font-display text-lg font-semibold">Descrivi il tuo ambito</h3>
            <p className="mt-1 text-[0.84rem] text-muted">
              Ruolo, settore, expertise — oppure allega un CV o un annuncio di lavoro.
            </p>
          </div>
          <textarea
            className="v-input min-h-28 resize-none"
            placeholder="Es: Sono un fisioterapista freelance…"
            value={scopeText}
            onChange={(e) => setScopeText(e.target.value)}
            autoFocus
          />
          <FileAttach
            attachment={scopeAttachment}
            onChange={setScopeAttachment}
            label="Allega CV / annuncio di lavoro"
          />
          <button
            onClick={submitScopeKnown}
            disabled={loading || (!scopeText.trim() && !scopeAttachment)}
            className="v-cta w-full"
          >
            Continua
          </button>
        </>
      )}
    </div>
  );
}
