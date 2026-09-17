import { desc, eq } from "drizzle-orm";
import { getOrCreateClientId } from "@/lib/clientId";
import { getDb } from "@/lib/db/client";
import { userMemories } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getOrCreateClientId();
  const db = getDb();
  const memories = await db
    .select()
    .from(userMemories)
    .where(eq(userMemories.clientId, clientId))
    .orderBy(desc(userMemories.updatedAt));

  return Response.json({ memories });
}

export async function POST(req: Request) {
  const clientId = await getOrCreateClientId();
  const body = await req.json().catch(() => null);

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!title || !content) return Response.json({ error: "Servono titolo e contenuto." }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .insert(userMemories)
    .values({ clientId, title: title.slice(0, 200), content, source: "manuale" })
    .returning({ id: userMemories.id });

  return Response.json(row);
}
