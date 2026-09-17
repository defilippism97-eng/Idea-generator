import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kbDocuments, kbDomains, kbPersonas } from "@/lib/db/schema";

export const runtime = "nodejs";

const MAX_DOC_CHARS = 6_000;
const MAX_TOTAL_CHARS = 18_000;

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

// Match "abbastanza buono" senza embedding/similarità semantica: conta le
// parole significative (>3 lettere) in comune tra il testo dell'utente e il
// nome/descrizione del dominio. Sufficiente per riconoscere "fisioterapista
// freelance" quando in KB c'è "fisioterapia freelance".
export async function POST(req: Request) {
  const body = await req.json();
  const text: string = (body.text ?? "").trim();
  if (!text) return Response.json({ domain: null });

  const db = getDb();
  const domains = await db.select().from(kbDomains);
  if (domains.length === 0) return Response.json({ domain: null });

  const textWords = new Set(normalize(text));
  let best: (typeof domains)[number] | null = null;
  let bestScore = 0;

  for (const d of domains) {
    const domainWords = normalize(`${d.name} ${d.description ?? ""}`);
    const score = domainWords.filter((w) => textWords.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }

  if (!best || bestScore < 2) return Response.json({ domain: null });

  const personas = await db.select().from(kbPersonas).where(eq(kbPersonas.domainId, best.id));
  const documents = await db.select().from(kbDocuments).where(eq(kbDocuments.domainId, best.id));

  // Il materiale caricato dall'utente entra nel contesto della conversazione,
  // troncato per non saturare la finestra dei modelli gratuiti.
  const material = documents
    .map((doc) => `### ${doc.title}\n${doc.text.slice(0, MAX_DOC_CHARS)}`)
    .join("\n\n")
    .slice(0, MAX_TOTAL_CHARS);

  return Response.json({
    domain: {
      id: best.id,
      name: best.name,
      description: best.description,
      personas,
      material: material || null,
      documentTitles: documents.map((d) => d.title),
    },
  });
}
