import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kbDocuments, kbDomains, kbPersonas } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const db = getDb();

  const domains = await db.select().from(kbDomains).orderBy(desc(kbDomains.updatedAt));
  const personas = await db.select().from(kbPersonas);
  // Il testo integrale dei documenti non serve all'elenco e può pesare
  // parecchio, ma serve a cercarci dentro: si legge e si scarta subito dopo.
  const documents = await db.select().from(kbDocuments);

  const result = domains
    .map((d) => {
      const domainPersonas = personas.filter((p) => p.domainId === d.id);
      const domainDocs = documents.filter((doc) => doc.domainId === d.id);
      // La ricerca guarda dentro descrizione, ruoli e testo dei documenti:
      // di un ambito ci si ricorda spesso un dettaglio, non il nome.
      const haystack = [
        d.name,
        d.description ?? "",
        ...domainPersonas.map((p) => `${p.name} ${p.systemPrompt}`),
        ...domainDocs.map((doc) => `${doc.title} ${doc.text}`),
      ]
        .join(" ")
        .toLowerCase();

      return {
        haystack,
        domain: {
          ...d,
          personas: domainPersonas,
          // Il testo integrale dei documenti non serve all'elenco e pesa:
          // resta qui solo per la ricerca.
          documents: domainDocs.map(({ id, domainId, title, createdAt }) => ({
            id,
            domainId,
            title,
            createdAt,
          })),
        },
      };
    })
    .filter((entry) => !query || entry.haystack.includes(query))
    .map((entry) => entry.domain);

  return Response.json({ domains: result });
}
