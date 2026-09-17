import { eq } from "drizzle-orm";
import { jsonrepair } from "jsonrepair";
import OpenAI from "openai";
import { getDb } from "@/lib/db/client";
import { kbDomains, kbPersonas } from "@/lib/db/schema";
import { streamWithFallback } from "@/lib/llmStream";
import { searchTavily } from "@/lib/tavily";
import { buildKbExpansionPrompt, FALLBACK_MODELS, KB_EXPANSION_SYSTEM_PROMPT } from "@/lib/vantage";

type PersonaSpec = { name: string; system_prompt: string };
type ExpansionResult = {
  description: string;
  domain_expert: PersonaSpec;
  mvp_designer: PersonaSpec;
  stakeholder: PersonaSpec;
};

function extractJson(text: string): ExpansionResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Il modello non ha restituito JSON valido.");
  const candidate = text.slice(start, end + 1);
  return JSON.parse(jsonrepair(candidate));
}

/**
 * Ricerca (Tavily, se configurata) + sintesi LLM dei 3 ruoli + salvataggio su
 * DB per un dato dominio. Condivisa tra l'endpoint manuale (/api/kb/expand)
 * e il job di espansione autonoma (Fase 4).
 */
export async function expandKbDomain(client: OpenAI, domain: string) {
  const tavilyKey = process.env.TAVILY_API_KEY;
  let sources: { title: string; url: string; content: string }[] = [];
  if (tavilyKey) {
    try {
      sources = await searchTavily(
        `${domain}: problemi quotidiani, strumenti software usati, tendenze e mercato`,
        tavilyKey,
      );
    } catch (err) {
      console.error("Tavily search failed", err);
    }
  }

  const userPrompt = buildKbExpansionPrompt(domain, sources);

  let parsed: ExpansionResult | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    try {
      const raw = (
        await streamWithFallback(
          client,
          FALLBACK_MODELS,
          6000,
          KB_EXPANSION_SYSTEM_PROMPT,
          [{ role: "user", content: userPrompt }],
          () => {},
        )
      ).text;
      parsed = extractJson(raw);
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Errore sconosciuto.";
    }
  }

  if (!parsed) throw new Error(`JSON non valido dopo 2 tentativi: ${lastError}`);

  const db = getDb();
  // Numerate come nel prompt, così i riferimenti [n] nella descrizione
  // puntano davvero alla fonte giusta.
  const domainSources = sources.map((s, i) => ({ n: i + 1, title: s.title, url: s.url }));
  const [existing] = await db.select().from(kbDomains).where(eq(kbDomains.name, domain)).limit(1);

  let domainId: string;
  if (existing) {
    domainId = existing.id;
    await db
      .update(kbDomains)
      .set({ description: parsed.description, sources: domainSources, updatedAt: new Date() })
      .where(eq(kbDomains.id, domainId));
    await db.delete(kbPersonas).where(eq(kbPersonas.domainId, domainId));
  } else {
    const [row] = await db
      .insert(kbDomains)
      .values({ name: domain, description: parsed.description, sources: domainSources })
      .returning({ id: kbDomains.id });
    domainId = row.id;
  }

  const personaRows = (["domain_expert", "mvp_designer", "stakeholder"] as const).map((role) => ({
    domainId,
    role,
    name: parsed![role].name,
    systemPrompt: parsed![role].system_prompt,
  }));
  await db.insert(kbPersonas).values(personaRows);

  return { domainId, description: parsed.description, personas: personaRows };
}

/** Chiede al modello un prossimo dominio/sotto-nicchia da aggiungere alla KB. */
export async function suggestNextDomain(
  client: OpenAI,
  mode: "domain" | "general",
  baseDomain: string | null,
  alreadyCovered: string[],
): Promise<string> {
  const coveredList = alreadyCovered.length
    ? `Ambiti già coperti in questa sessione di espansione (non ripeterli): ${alreadyCovered.join(", ")}.`
    : "Nessun ambito ancora coperto in questa sessione.";

  const prompt =
    mode === "domain"
      ? `Il tema di riferimento è: "${baseDomain}". ${coveredList}\n\nSuggerisci UNA sotto-nicchia o variante specifica e concreta di questo tema, abbastanza diversa dagli ambiti già coperti da meritare una scheda dedicata nella knowledge base (es. se il tema è "fisioterapia freelance", una sotto-nicchia potrebbe essere "osteopatia pediatrica freelance" o "fisioterapia sportiva per team dilettantistici"). Rispondi SOLO con il nome dell'ambito, una riga, senza spiegazioni.`
      : `${coveredList}\n\nSuggerisci UN bisogno professionale emergente o un'opportunità di mercato interessante per un micro-tool/MVP, in qualunque settore (professionale, consumer, hobbistico) — qualcosa di specifico e concreto, non generico. Rispondi SOLO con il nome dell'ambito, una riga, senza spiegazioni.`;

  const { text } = await streamWithFallback(
    client,
    FALLBACK_MODELS,
    100,
    "Rispondi sempre in italiano, in una sola riga, senza markdown.",
    [{ role: "user", content: prompt }],
    () => {},
  );

  const candidate = text.trim().replace(/^["']|["']$/g, "").split("\n")[0].slice(0, 120);

  if (!isPlausibleTopic(candidate)) {
    // A volte il modello produce testo incoerente ("word salad") invece di
    // un nome di ambito: meglio un fallback deterministico che bloccare
    // l'intero job o inquinare la KB con un dominio senza senso.
    return mode === "domain" && baseDomain
      ? `${baseDomain} — variante ${alreadyCovered.length + 1}`
      : `Automazione per un attrito quotidiano non ancora esplorato (variazione ${alreadyCovered.length + 1})`;
  }

  return candidate;
}

/** Scarta risposte "word salad": troppe parole, parole anomale lunghe, o assenza di spazi. */
function isPlausibleTopic(text: string): boolean {
  if (!text || text.length < 3) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 12) return false;
  if (words.some((w) => w.replace(/[^\p{L}]/gu, "").length > 22)) return false;
  return true;
}
