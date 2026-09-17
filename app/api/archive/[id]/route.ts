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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getOrCreateClientId();
  const db = getDb();

  await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.clientId, clientId)));
  return Response.json({ ok: true });
}
