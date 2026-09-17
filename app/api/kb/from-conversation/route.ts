import { eq } from "drizzle-orm";
import { jsonrepair } from "jsonrepair";
import { getDb } from "@/lib/db/client";
import { kbDocuments, kbDomains, kbPersonas } from "@/lib/db/schema";
import { createClient, streamWithFallback } from "@/lib/llmStream";
import { buildKbAbsorbPrompt, FALLBACK_MODELS, KB_ABSORB_SYSTEM_PROMPT } from "@/lib/vantage";

export const runtime = "nodejs";
export const maxDuration = 300;

type PersonaSpec = { name?: string; system_prompt?: string };
type Absorbed = {
  domain?: string;
  description?: string;
  domain_expert?: PersonaSpec;
  mvp_designer?: PersonaSpec;
  stakeholder?: PersonaSpec;
};

function parse(raw: string): Absorbed {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Il modello non ha restituito JSON valido.");
  return JSON.parse(jsonrepair(raw.slice(start, end + 1)));
}

/**
 * Porta in knowledge base quello che è emerso in una conversazione, documenti
 * allegati compresi: riusa un ambito esistente se il tema è lo stesso,
 * altrimenti ne crea uno nuovo con un nome sensato.
 */
export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY non configurata." }, { status: 500 });

  const body = await req.json().catch(() => null);
  const conversation = typeof body?.conversation === "string" ? body.conversation.trim() : "";
  const documents: { filename: string; text: string }[] = Array.isArray(body?.documents)
    ? body.documents.filter(
        (d: unknown): d is { filename: string; text: string } =>
          typeof (d as { filename?: unknown }).filename === "string" &&
          typeof (d as { text?: unknown }).text === "string",
      )
    : [];

  if (!conversation && documents.length === 0) {
    return Response.json({ error: "Non c'è niente da archiviare." }, { status: 400 });
  }

  const db = getDb();
  const existing = await db.select({ name: kbDomains.name }).from(kbDomains);

  const client = createClient(apiKey);
  const { text: raw } = await streamWithFallback(
    client,
    FALLBACK_MODELS,
    6000,
    KB_ABSORB_SYSTEM_PROMPT,
    [
      {
        role: "user",
        content: buildKbAbsorbPrompt(
          existing.map((d) => d.name),
          conversation,
          documents,
        ),
      },
    ],
    () => {},
  );

  const parsed = parse(raw);
  const name = (parsed.domain ?? "").trim();
  if (!name) return Response.json({ error: "Il modello non ha proposto un ambito." }, { status: 502 });

  // Il modello dichiara se l'ambito è nuovo, ma a decidere è il database:
  // se il nome esiste già si aggiorna quello, senza crearne un doppione.
  const [match] = await db.select().from(kbDomains).where(eq(kbDomains.name, name)).limit(1);

  let domainId: string;
  let reused = false;
  if (match) {
    domainId = match.id;
    reused = true;
    if (parsed.description) {
      await db
        .update(kbDomains)
        .set({ description: parsed.description, updatedAt: new Date() })
        .where(eq(kbDomains.id, domainId));
    }
    await db.delete(kbPersonas).where(eq(kbPersonas.domainId, domainId));
  } else {
    const [row] = await db
      .insert(kbDomains)
      .values({ name: name.slice(0, 200), description: parsed.description ?? null, origin: "manuale" })
      .returning({ id: kbDomains.id });
    domainId = row.id;
  }

  const roles = (["domain_expert", "mvp_designer", "stakeholder"] as const)
    .map((role) => ({
      domainId,
      role,
      name: (parsed[role]?.name ?? "").trim(),
      systemPrompt: (parsed[role]?.system_prompt ?? "").trim(),
    }))
    .filter((r) => r.name && r.systemPrompt);
  if (roles.length > 0) await db.insert(kbPersonas).values(roles);

  // I documenti della conversazione diventano materiale dell'ambito, per
  // intero: è il posto dove possono restare senza pesare su ogni chat.
  if (documents.length > 0) {
    await db.insert(kbDocuments).values(
      documents.map((d) => ({ domainId, title: d.filename.slice(0, 200), text: d.text })),
    );
  }

  return Response.json({ domain: name, reused, roles: roles.length, documents: documents.length });
}
