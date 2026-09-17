import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kbDomains, kbPersonas } from "@/lib/db/schema";

export const runtime = "nodejs";

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
  return Response.json({
    domain: { id: best.id, name: best.name, description: best.description, personas },
  });
}
