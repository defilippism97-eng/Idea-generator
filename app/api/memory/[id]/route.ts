import { and, eq } from "drizzle-orm";
import { getOrCreateClientId } from "@/lib/clientId";
import { getDb } from "@/lib/db/client";
import { userMemories } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getOrCreateClientId();
  const body = await req.json().catch(() => null);

  const patch: { title?: string; content?: string; active?: boolean; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (typeof body?.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 200);
  if (typeof body?.content === "string" && body.content.trim()) patch.content = body.content.trim();
  if (typeof body?.active === "boolean") patch.active = body.active;

  const db = getDb();
  const [row] = await db
    .update(userMemories)
    .set(patch)
    .where(and(eq(userMemories.id, id), eq(userMemories.clientId, clientId)))
    .returning({ id: userMemories.id });

  if (!row) return Response.json({ error: "Ricordo non trovato." }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getOrCreateClientId();
  const db = getDb();
  await db.delete(userMemories).where(and(eq(userMemories.id, id), eq(userMemories.clientId, clientId)));
  return Response.json({ ok: true });
}
