import { getDb } from "@/lib/db/client";
import { kbDocuments } from "@/lib/db/schema";

export const runtime = "nodejs";

const MAX_CHARS = 200_000;

/**
 * Aggiunge materiale dell'utente all'ambito. Il testo arriva già estratto dal
 * client (che passa per /api/extract per PDF/Word/Excel), così qui non serve
 * ripetere la logica di parsing.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!title || !text) return Response.json({ error: "Servono titolo e contenuto." }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .insert(kbDocuments)
    .values({ domainId: id, title: title.slice(0, 200), text: text.slice(0, MAX_CHARS) })
    .returning({ id: kbDocuments.id, title: kbDocuments.title });

  return Response.json(row);
}
