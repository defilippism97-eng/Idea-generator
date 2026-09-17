import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kbDomains } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  const patch: { name?: string; description?: string | null; updatedAt: Date } = { updatedAt: new Date() };
  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 200);
  if (typeof body?.description === "string") patch.description = body.description.trim() || null;

  const db = getDb();
  const [row] = await db
    .update(kbDomains)
    .set(patch)
    .where(eq(kbDomains.id, id))
    .returning({ id: kbDomains.id, name: kbDomains.name, description: kbDomains.description });

  if (!row) return Response.json({ error: "Ambito non trovato." }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  // Ruoli e documenti collegati spariscono in cascata (vedi schema).
  await db.delete(kbDomains).where(eq(kbDomains.id, id));
  return Response.json({ ok: true });
}
