import { and, eq } from "drizzle-orm";
import { jsonrepair } from "jsonrepair";
import { getOrCreateClientId } from "@/lib/clientId";
import { getDb } from "@/lib/db/client";
import { userMemories } from "@/lib/db/schema";
import { createClient, streamWithFallback } from "@/lib/llmStream";
import {
  CV_PROFILING_SYSTEM_PROMPT,
  FALLBACK_MODELS,
  MEMORY_EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/vantage";

export const runtime = "nodejs";

const MAX_INPUT_CHARS = 20_000;
const MAX_NEW_MEMORIES = 6;

type Extracted = { memories?: { title?: string; content?: string }[] };

const SIMILARITY_THRESHOLD = 0.55;

function words(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

/** Due frasi che dicono la stessa cosa con parole diverse condividono gran parte dei termini pieni. */
function tooSimilar(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size) >= SIMILARITY_THRESHOLD;
}

function parseMemories(raw: string): { title: string; content: string }[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  let parsed: Extracted;
  try {
    parsed = JSON.parse(jsonrepair(raw.slice(start, end + 1)));
  } catch {
    return [];
  }
  return (parsed.memories ?? [])
    .map((m) => ({ title: (m.title ?? "").trim(), content: (m.content ?? "").trim() }))
    .filter((m) => m.title && m.content)
    .slice(0, MAX_NEW_MEMORIES);
}

/**
 * Ricava fatti stabili sull'utente da una conversazione o da un CV e li
 * salva nella memoria. Pensato per essere chiamato senza bloccare la chat:
 * se fallisce, la conversazione prosegue lo stesso.
 */
export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY non configurata." }, { status: 500 });

  const clientId = await getOrCreateClientId();
  const body = await req.json().catch(() => null);
  const source: "conversazione" | "cv" = body?.source === "cv" ? "cv" : "conversazione";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "Niente da analizzare." }, { status: 400 });

  const db = getDb();
  const existing = await db
    .select({ title: userMemories.title, content: userMemories.content })
    .from(userMemories)
    .where(eq(userMemories.clientId, clientId));

  // Il modello riformula volentieri gli stessi fatti: per non riempire la
  // memoria di doppioni gli si mostra prima cosa sa già.
  const known = existing.map((m) => `- ${m.title}: ${m.content}`).join("\n");
  const prompt = known
    ? `Già in memoria:\n${known}\n\n---\n\n${text.slice(0, MAX_INPUT_CHARS)}`
    : text.slice(0, MAX_INPUT_CHARS);

  const client = createClient(apiKey);
  const { text: raw } = await streamWithFallback(
    client,
    FALLBACK_MODELS,
    1500,
    source === "cv" ? CV_PROFILING_SYSTEM_PROMPT : MEMORY_EXTRACTION_SYSTEM_PROMPT,
    [{ role: "user", content: prompt }],
    () => {},
  );

  const candidates = parseMemories(raw);
  if (candidates.length === 0) return Response.json({ added: [] });

  // Rete di sicurezza: anche istruito, il modello a volte ripete. Si scarta
  // ciò che somiglia troppo a un ricordo già presente.
  const fresh = candidates.filter(
    (m) => !existing.some((e) => tooSimilar(m.content, e.content) || tooSimilar(m.title, e.title)),
  );
  if (fresh.length === 0) return Response.json({ added: [] });

  const added = await db
    .insert(userMemories)
    .values(fresh.map((m) => ({ clientId, title: m.title.slice(0, 200), content: m.content, source })))
    .returning({ id: userMemories.id, title: userMemories.title });

  return Response.json({ added });
}

/** Cancella tutti i ricordi di questo browser. */
export async function DELETE() {
  const clientId = await getOrCreateClientId();
  const db = getDb();
  await db.delete(userMemories).where(and(eq(userMemories.clientId, clientId)));
  return Response.json({ ok: true });
}
