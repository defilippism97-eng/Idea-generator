import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kbPersonas } from "@/lib/db/schema";

export const runtime = "nodejs";

const ROLES = ["domain_expert", "mvp_designer", "stakeholder"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}

/** Compila a mano uno dei tre ruoli dell'ambito (sostituisce quello esistente). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!isRole(body?.role)) return Response.json({ error: "Ruolo non valido." }, { status: 400 });
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const systemPrompt = typeof body?.systemPrompt === "string" ? body.systemPrompt.trim() : "";
  if (!name || !systemPrompt) {
    return Response.json({ error: "Servono sia il nome sia le istruzioni del ruolo." }, { status: 400 });
  }

  const db = getDb();
  await db.delete(kbPersonas).where(and(eq(kbPersonas.domainId, id), eq(kbPersonas.role, body.role)));
  const [row] = await db
    .insert(kbPersonas)
    .values({ domainId: id, role: body.role, name: name.slice(0, 200), systemPrompt })
    .returning({ id: kbPersonas.id });

  return Response.json(row);
}
