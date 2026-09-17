"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown, Reference } from "./Markdown";

export const READING_SPEEDS = [
  { id: "lento", label: "Lento", hint: "Per seguire parola per parola", cps: 22 },
  { id: "normale", label: "Normale", hint: "Ritmo di lettura comodo", cps: 45 },
  { id: "veloce", label: "Veloce", hint: "Scorre rapido, si scansiona", cps: 95 },
  { id: "immediato", label: "Immediato", hint: "Nessuna animazione", cps: 0 },
] as const;

export type SpeedId = (typeof READING_SPEEDS)[number]["id"];

export const DEFAULT_SPEED: SpeedId = "normale";

export function isSpeedId(value: unknown): value is SpeedId {
  return READING_SPEEDS.some((s) => s.id === value);
}

function cpsFor(id: SpeedId): number {
  return READING_SPEEDS.find((s) => s.id === id)?.cps ?? 45;
}

// Quanti secondi di lettura si accetta di restare indietro prima di
// accelerare. Sotto questa soglia la cadenza è esattamente quella scelta:
// se si sceglie "Lento" si deve davvero leggere piano, anche quando il
// modello sputa fuori tutto in una raffica.
const MAX_LAG_SECONDS = 25;

/**
 * Svela il testo a cadenza costante invece di seguire i chunk di rete, che
 * arrivano a raffiche irregolari e rendono la lettura faticosa.
 *
 * Oltre la soglia di ritardo la cadenza cresce in modo dolce e proporzionale,
 * così un documento lungo non impiega minuti a comparire; chi non vuole
 * aspettare ha comunque "Mostra tutto".
 */
function useSmoothReveal(target: string, streaming: boolean, speed: SpeedId) {
  // Se il messaggio è già completo al primo render (es. caricato
  // dall'archivio) non va animato: si mostra e basta.
  const [animated] = useState(() => streaming && cpsFor(speed) > 0);
  const [skipped, setSkipped] = useState(false);

  const targetRef = useRef(target);
  targetRef.current = target;
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const lenRef = useRef(animated ? 0 : target.length);
  const [shownLen, setShownLen] = useState(lenRef.current);

  const active = animated && !skipped;

  useEffect(() => {
    if (!active) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      // Cap del delta: tornando su una scheda in background non deve
      // sbloccarsi tutto il testo in un fotogramma solo.
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      const total = targetRef.current.length;
      const backlog = total - lenRef.current;

      if (backlog > 0) {
        const base = cpsFor(speedRef.current);
        let rate: number;
        if (base <= 0) {
          rate = Infinity;
        } else {
          const maxLag = base * MAX_LAG_SECONDS;
          const excess = Math.max(0, backlog - maxLag);
          rate = base * (1 + excess / maxLag);
        }
        lenRef.current = Math.min(total, lenRef.current + rate * dt);
        setShownLen(lenRef.current);
      } else if (!streamingRef.current) {
        return; // finito e in pari: niente più frame da chiedere
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const revealAll = useCallback(() => setSkipped(true), []);

  if (!active) return { shown: target, pending: 0, revealAll };
  const visible = Math.floor(shownLen);
  return { shown: target.slice(0, visible), pending: target.length - visible, revealAll };
}

export function StreamedMarkdown({
  text,
  streaming,
  speed,
  variant,
  references,
  placeholder,
}: {
  text: string;
  streaming: boolean;
  speed: SpeedId;
  variant?: "chat" | "doc";
  references?: Reference[];
  placeholder: React.ReactNode;
}) {
  const { shown, pending, revealAll } = useSmoothReveal(text, streaming, speed);

  if (!shown) return <>{placeholder}</>;

  return (
    <>
      <Markdown text={shown} variant={variant} references={references} />
      {pending > 0 && (
        <button
          onClick={revealAll}
          className="mt-2 text-[0.7rem] text-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-ink"
        >
          Mostra tutto ({pending} caratteri in coda)
        </button>
      )}
    </>
  );
}
