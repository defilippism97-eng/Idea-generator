import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kbDomains } from "@/lib/db/schema";

export const runtime = "nodejs";

/** Crea un ambito a mano, senza ricerca: i ruoli si compilano poi uno a uno. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!name) return Response.json({ error: "Serve un nome per l'ambito." }, { status: 400 });

  const db = getDb();
  const [existing] = await db.select().from(kbDomains).where(eq(kbDomains.name, name)).limit(1);
  if (existing) return Response.json({ error: "Esiste già un ambito con questo nome." }, { status: 409 });

  const [row] = await db
    .insert(kbDomains)
    .values({ name: name.slice(0, 200), description: description || null, origin: "manuale" })
    .returning({ id: kbDomains.id, name: kbDomains.name });

  return Response.json(row);
}
