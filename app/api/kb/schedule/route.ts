import { and, desc, eq, lt } from "drizzle-orm";
import { createClient } from "@/lib/llmStream";
import { expandKbDomain, suggestNextDomain } from "@/lib/kbExpand";
import { getDb } from "@/lib/db/client";
import { kbExpansionJobs } from "@/lib/db/schema";

export const runtime = "nodejs";

const MAX_MINUTES = 240; // 4 ore, per non far girare un job in eterno per errore
const MAX_ITERATIONS = 30;
const PAUSE_BETWEEN_MS = 20_000; // rispetta il rate limit dei modelli free
const STALE_GRACE_MS = 3 * 60_000; // margine oltre endsAt prima di considerare un job "running" orfano

// Se il processo Node si riavvia (deploy, crash) mentre un job gira, il loop
// in memoria muore senza poter aggiornare lo stato: resterebbe "running" per
// sempre. Alla prossima GET/POST, ripuliamo i job scaduti da un pezzo che
// sono rimasti bloccati così.
async function reapStaleJobs() {
  const db = getDb();
  await db
    .update(kbExpansionJobs)
    .set({ status: "error" })
    .where(
      and(
        eq(kbExpansionJobs.status, "running"),
        lt(kbExpansionJobs.endsAt, new Date(Date.now() - STALE_GRACE_MS)),
      ),
    );
}

export async function GET() {
  await reapStaleJobs();
  const db = getDb();
  const jobs = await db.select().from(kbExpansionJobs).orderBy(desc(kbExpansionJobs.startedAt)).limit(10);
  return Response.json({ jobs });
}

export async function POST(req: Request) {
  await reapStaleJobs();
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    return Response.json({ error: "OPENROUTER_API_KEY non configurata." }, { status: 500 });
  }

  const body = await req.json();
  const mode: "domain" | "general" = body.mode === "domain" ? "domain" : "general";
  const domain: string | null = mode === "domain" ? (body.domain ?? "").trim() || null : null;
  const durationMinutes = Math.min(Math.max(Number(body.durationMinutes) || 30, 5), MAX_MINUTES);

  if (mode === "domain" && !domain) {
    return Response.json({ error: "Specifica un ambito per la modalità 'ambito specifico'." }, { status: 400 });
  }

  const db = getDb();
  const endsAt = new Date(Date.now() + durationMinutes * 60_000);
  const [job] = await db
    .insert(kbExpansionJobs)
    .values({ mode, domain, status: "running", endsAt })
    .returning({ id: kbExpansionJobs.id });

  // Fire-and-forget: il loop continua a girare nel processo Node persistente
  // (Render) ben oltre questa risposta HTTP. Su una piattaforma serverless
  // classica (Vercel) questo si fermerebbe non appena la funzione termina.
  runExpansionLoop(job.id, mode, domain, endsAt, openrouterKey).catch((err) => {
    console.error("KB expansion loop crashed", err);
  });

  return Response.json({ jobId: job.id });
}

async function isCancelled(jobId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ cancelRequested: kbExpansionJobs.cancelRequested })
    .from(kbExpansionJobs)
    .where(eq(kbExpansionJobs.id, jobId))
    .limit(1);
  return Boolean(row?.cancelRequested);
}

async function appendLog(jobId: string, message: string) {
  const db = getDb();
  const [row] = await db
    .select({ log: kbExpansionJobs.log })
    .from(kbExpansionJobs)
    .where(eq(kbExpansionJobs.id, jobId))
    .limit(1);
  const nextLog = [...(row?.log ?? []), { at: new Date().toISOString(), message }];
  await db.update(kbExpansionJobs).set({ log: nextLog }).where(eq(kbExpansionJobs.id, jobId));
}

async function runExpansionLoop(
  jobId: string,
  mode: "domain" | "general",
  baseDomain: string | null,
  endsAt: Date,
  apiKey: string,
) {
  const client = createClient(apiKey);
  const db = getDb();
  const covered: string[] = [];
  let iterations = 0;

  await appendLog(jobId, `Avviato — modalità: ${mode === "domain" ? `ambito "${baseDomain}"` : "bisogni emergenti generali"}.`);

  try {
    // Prima iterazione: se e' modalita' "ambito", parte dal dominio esatto
    // indicato dall'utente; altrimenti chiede subito un suggerimento.
    let nextTopic = mode === "domain" ? baseDomain! : await suggestNextDomain(client, mode, null, []);

    while (Date.now() < endsAt.getTime() && iterations < MAX_ITERATIONS) {
      if (await isCancelled(jobId)) {
        await appendLog(jobId, `Fermato su richiesta — ${covered.length} ambiti processati.`);
        await db.update(kbExpansionJobs).set({ status: "stopped" }).where(eq(kbExpansionJobs.id, jobId));
        return;
      }
      iterations++;
      try {
        await appendLog(jobId, `[${iterations}] Espando: "${nextTopic}"…`);
        await expandKbDomain(client, nextTopic);
        covered.push(nextTopic);
        await db
          .update(kbExpansionJobs)
          .set({ domainsProcessed: covered })
          .where(eq(kbExpansionJobs.id, jobId));
        await appendLog(jobId, `[${iterations}] ✅ "${nextTopic}" aggiunto/aggiornato in KB.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Errore sconosciuto.";
        await appendLog(jobId, `[${iterations}] ⚠️ Errore su "${nextTopic}": ${message}`);
      }

      if (Date.now() >= endsAt.getTime() || iterations >= MAX_ITERATIONS) break;

      // La pausa è lunga: spezzarla permette di reagire a uno stop senza
      // far aspettare l'utente fino al ciclo successivo.
      for (let waited = 0; waited < PAUSE_BETWEEN_MS; waited += 2000) {
        await new Promise((r) => setTimeout(r, 2000));
        if (await isCancelled(jobId)) break;
      }

      try {
        nextTopic = await suggestNextDomain(client, mode, baseDomain, covered);
      } catch {
        break; // se anche suggerire il prossimo tema fallisce, meglio fermarsi
      }
    }

    await appendLog(jobId, `Terminato — ${covered.length} ambiti processati.`);
    await db.update(kbExpansionJobs).set({ status: "done" }).where(eq(kbExpansionJobs.id, jobId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto.";
    await appendLog(jobId, `Interrotto per errore: ${message}`);
    await db.update(kbExpansionJobs).set({ status: "error" }).where(eq(kbExpansionJobs.id, jobId));
  }
}
