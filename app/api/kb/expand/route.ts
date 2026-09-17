import { eq } from "drizzle-orm";
import { createClient, streamWithContinuation } from "@/lib/llmStream";
import { searchTavily } from "@/lib/tavily";
import { buildKbExpansionPrompt, KB_EXPANSION_SYSTEM_PROMPT, MODEL_SYNTHESIS } from "@/lib/vantage";
import { getDb } from "@/lib/db/client";
import { kbDomains, kbPersonas } from "@/lib/db/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(req: Request) {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!openrouterKey) {
    return Response.json({ error: "OPENROUTER_API_KEY non configurata." }, { status: 500 });
  }

  const body = await req.json();
  const domain: string = (body.domain ?? "").trim();
  if (!domain) return Response.json({ error: "Dominio mancante." }, { status: 400 });

  let sources: { title: string; url: string; content: string }[] = [];
  if (tavilyKey) {
    try {
      sources = await searchTavily(
        `${domain}: pain point quotidiani, strumenti software usati, tendenze e mercato`,
        tavilyKey,
      );
    } catch (err) {
      // La ricerca è un arricchimento: se fallisce, procediamo comunque
      // sulla sola conoscenza del modello invece di bloccare l'espansione.
      console.error("Tavily search failed", err);
    }
  }

  const client = createClient(openrouterKey);
  const userPrompt = buildKbExpansionPrompt(domain, sources);

  let raw: string;
  try {
    raw = await streamWithContinuation(
      client,
      MODEL_SYNTHESIS,
      3000,
      KB_EXPANSION_SYSTEM_PROMPT,
      [{ role: "user", content: userPrompt }],
      () => {},
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto.";
    return Response.json({ error: `Errore LLM: ${message}` }, { status: 502 });
  }

  let parsed: ExpansionResult;
  try {
    parsed = extractJson(raw);
  } catch {
    return Response.json(
      { error: "Risposta del modello non interpretabile come JSON.", raw },
      { status: 502 },
    );
  }

  const db = getDb();
  const domainSources = sources.map((s) => ({ title: s.title, url: s.url }));

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
    name: parsed[role].name,
    systemPrompt: parsed[role].system_prompt,
  }));
  await db.insert(kbPersonas).values(personaRows);

  return Response.json({ domainId, description: parsed.description, personas: personaRows });
}
