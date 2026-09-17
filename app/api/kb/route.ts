import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kbDocuments, kbDomains, kbPersonas } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const domains = await db.select().from(kbDomains).orderBy(desc(kbDomains.updatedAt));
  const personas = await db.select().from(kbPersonas);
  // Il testo integrale dei documenti non serve all'elenco e può pesare
  // parecchio: qui basta l'anteprima, il resto si legge su richiesta.
  const documents = await db
    .select({
      id: kbDocuments.id,
      domainId: kbDocuments.domainId,
      title: kbDocuments.title,
      createdAt: kbDocuments.createdAt,
    })
    .from(kbDocuments);

  const result = domains.map((d) => ({
    ...d,
    personas: personas.filter((p) => p.domainId === d.id),
    documents: documents.filter((doc) => doc.domainId === d.id),
  }));

  return Response.json({ domains: result });
}
