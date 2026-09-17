"use client";

import { useEffect, useRef, useState } from "react";

// L'API di riconoscimento vocale del browser non è nei tipi standard del DOM:
// qui si dichiara solo il minimo che serve. Gira tutta sul client, senza
// backend e senza costi — è l'unica strada compatibile col vincolo di
// costo zero del progetto.
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: { length: number } & SpeechResult[] };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Pulsante per dettare invece di scrivere. Restituisce il testo riconosciuto
 * man mano, così si vede comparire mentre si parla.
 *
 * Non tutti i browser hanno questa API (Firefox no): dove manca, il pulsante
 * non compare affatto invece di mostrarsi e non funzionare.
 */
export function VoiceInput({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string, isFinal: boolean) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = "it-IT";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      // Ogni evento riporta solo i risultati nuovi: si concatena il parziale
      // per farlo vedere subito, e si consegna come definitivo solo ciò che
      // il riconoscitore non cambierà più.
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final) onTranscript(final, true);
      else if (interim) onTranscript(interim, false);
    };

    recognition.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Microfono non autorizzato dal browser."
          : e.error === "no-speech"
            ? null
            : "Il riconoscimento vocale si è interrotto.",
      );
      stop();
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    try {
      recognition.start();
    } catch {
      // Senza microfono disponibile start() può fallire subito: senza questa
      // rete il pulsante resterebbe acceso su una dettatura mai partita.
      setError("Non riesco ad accedere al microfono.");
      stop();
    }
  }

  if (!supported) return null;

  return (
    <span className="relative shrink-0">
      {error && (
        <span className="animate-fade-in v-panel absolute bottom-full right-0 mb-2 w-max max-w-56 rounded-lg px-2.5 py-1.5 text-[0.7rem] text-red-400 shadow-lg">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-30 ${
          listening
            ? "animate-pulse border-[var(--gold)] text-gold"
            : "border-line text-muted hover:border-line-strong hover:text-ink"
        }`}
        title={listening ? "Ferma la dettatura" : "Detta invece di scrivere"}
        aria-label={listening ? "Ferma la dettatura" : "Detta invece di scrivere"}
        aria-pressed={listening}
      >
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
          <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
    </span>
  );
}
