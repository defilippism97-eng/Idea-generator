import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kbPersonas } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  const patch: { name?: string; systemPrompt?: string } = {};
  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 200);
  if (typeof body?.systemPrompt === "string" && body.systemPrompt.trim()) {
    patch.systemPrompt = body.systemPrompt.trim();
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Niente da aggiornare." }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .update(kbPersonas)
    .set(patch)
    .where(eq(kbPersonas.id, id))
    .returning({ id: kbPersonas.id, name: kbPersonas.name, systemPrompt: kbPersonas.systemPrompt });

  if (!row) return Response.json({ error: "Ruolo non trovato." }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  await db.delete(kbPersonas).where(eq(kbPersonas.id, id));
  return Response.json({ ok: true });
}
