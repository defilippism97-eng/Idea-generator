import { and, eq } from "drizzle-orm";
import { getOrCreateClientId } from "@/lib/clientId";
import { getDb } from "@/lib/db/client";
import { conversations } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getOrCreateClientId();
  const db = getDb();

  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.clientId, clientId)))
    .limit(1);

  if (!row) return Response.json({ error: "Non trovata." }, { status: 404 });
  return Response.json(row);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getOrCreateClientId();
  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (!title) return Response.json({ error: "Titolo mancante." }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .update(conversations)
    .set({ title: title.slice(0, 200), updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.clientId, clientId)))
    .returning({ id: conversations.id, title: conversations.title });

  if (!row) return Response.json({ error: "Non trovata." }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getOrCreateClientId();
  const db = getDb();

  await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.clientId, clientId)));
  return Response.json({ ok: true });
}
