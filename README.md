# Vantage — Venture Architect Agent

Agente conversazionale che profila un professionista e genera concept di micro-tool/Micro-SaaS ad alto valore aggiunto, con schede MVP azionabili pronte per un builder agent o un IDE.

## Flusso

1. **Intake & Profilazione Dinamica** — intervista adattiva (2-3 domande per volta) su ruolo, settore, competenze tecniche, network e pain point.
2. **Filtraggio Tecnico & Strategico** — ogni idea è stress-testata con il "Commodity LLM Test" e il "Build vs Buy Test".
3. **Scheda MVP Teorica** — output strutturato con 2-3 concept, ciascuno con pain point, differenziale, architettura MVP e strategia di validazione.

Il system prompt completo e la matrice di knowledge base sugli archetipi di differenziazione sono in `lib/vantage.ts`.

## Tiering dei modelli

Come da standard di progetto (`CLAUDE.md`):

- **Sonnet 5** guida l'intervista e il filtraggio (Fasi 1-2), nella chat normale.
- **Opus** viene invocato solo per la sintesi finale, tramite il pulsante "Genera Scheda MVP (Opus)".

## Setup

```bash
npm install
cp .env.example .env.local   # imposta ANTHROPIC_API_KEY
npm run dev
```

Apri http://localhost:3000.
