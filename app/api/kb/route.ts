import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kbDomains, kbPersonas } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const domains = await db.select().from(kbDomains).orderBy(desc(kbDomains.updatedAt));
  const personas = await db.select().from(kbPersonas);

  const result = domains.map((d) => ({
    ...d,
    personas: personas.filter((p) => p.domainId === d.id),
  }));

  return Response.json({ domains: result });
}
