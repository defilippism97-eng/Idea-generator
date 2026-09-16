# Standard Architetturali e Operativi

- **Strategia di Mappatura:** Il focus del progetto è l'analisi e la strutturazione dei dati. Non alterare mai la logica di "core data extraction" senza un'approvazione in modalità plan.
- **Tiering dei Modelli:** Sfrutta Claude Sonnet 5 per l'estrazione dati massiva da PDF e per i suggerimenti di responsabilità dei ruoli; scala su Claude Opus per la sintesi e la generazione della reportistica finale.
- **Offloading del Contesto:** Per l'elaborazione di ampi dataset, utilizza la shortcut `Ctrl+B` per delegare l'audit a un sub-agente in background.
