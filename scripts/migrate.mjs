// Applica le migrazioni SQL all'avvio, prima che il server accetti richieste.
// Senza questo passaggio un deploy con nuove colonne parte e poi fallisce a
// runtime, perché il database resta indietro rispetto al codice.
//
// È volutamente tollerante: il database di produzione esisteva già prima che
// ci fosse un registro delle migrazioni, quindi gli errori "esiste già" non
// sono un problema ma la prova che quel pezzo era stato applicato a mano.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const ALREADY_THERE = new Set([
  "42P07", // tabella o indice duplicato
  "42701", // colonna duplicata
  "42710", // oggetto duplicato (es. vincolo)
  "42P16", // definizione di tabella non valida perché già presente
]);

// In produzione le variabili arrivano dall'ambiente; in locale stanno in
// .env.local, che Next carica da solo ma questo script no.
async function loadLocalEnv() {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) return;
  try {
    const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // nessun .env.local: normale in produzione
  }
}

await loadLocalEnv();

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL non configurata: salto le migrazioni.");
  process.exit(0);
}

const dir = path.join(process.cwd(), "drizzle");
const sql = postgres(url, { max: 1, onnotice: () => {} });

// Un database serverless può essere "freddo" proprio quando parte il deploy:
// un paio di tentativi evitano che un'indisponibilità di pochi secondi
// impedisca all'applicazione di avviarsi del tutto.
async function connectWithRetries(attempts = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      await sql`SELECT 1`;
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      const wait = attempt * 2000;
      console.log(`[migrate] database non raggiungibile (${err.code ?? err.message}), riprovo tra ${wait / 1000}s…`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

try {
  await connectWithRetries();

  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  const done = new Set((await sql`SELECT name FROM _migrations`).map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (done.has(file)) continue;
    const contents = await readFile(path.join(dir, file), "utf8");
    try {
      await sql.unsafe(contents);
      console.log(`[migrate] applicata ${file}`);
    } catch (err) {
      if (!ALREADY_THERE.has(err.code)) throw err;
      console.log(`[migrate] ${file}: già presente, la segno come applicata`);
    }
    await sql`INSERT INTO _migrations (name) VALUES (${file}) ON CONFLICT DO NOTHING`;
  }

  console.log("[migrate] database allineato.");
} catch (err) {
  console.error("[migrate] errore:", err.message);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
