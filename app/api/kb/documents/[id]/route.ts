import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kbDocuments } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [row] = await db.select().from(kbDocuments).where(eq(kbDocuments.id, id)).limit(1);
  if (!row) return Response.json({ error: "Documento non trovato." }, { status: 404 });
  return Response.json(row);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  const patch: { title?: string; text?: string } = {};
  if (typeof body?.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 200);
  if (typeof body?.text === "string" && body.text.trim()) patch.text = body.text.trim();
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Niente da aggiornare." }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .update(kbDocuments)
    .set(patch)
    .where(eq(kbDocuments.id, id))
    .returning({ id: kbDocuments.id, title: kbDocuments.title });

  if (!row) return Response.json({ error: "Documento non trovato." }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  await db.delete(kbDocuments).where(eq(kbDocuments.id, id));
  return Response.json({ ok: true });
}
