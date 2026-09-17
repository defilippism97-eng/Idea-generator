import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getOrCreateClientId } from "@/lib/clientId";
import { getDb } from "@/lib/db/client";
import { conversations } from "@/lib/db/schema";

export const runtime = "nodejs";

type Message = { role: string; content: string; variant?: string };

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user")?.content;
  if (firstUser) return firstUser.slice(0, 80);
  return "Conversazione senza titolo";
}

export async function GET(req: Request) {
  const clientId = await getOrCreateClientId();
  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const db = getDb();

  // La ricerca guarda anche dentro i messaggi, non solo nel titolo: quello che
  // si ricorda di una conversazione è spesso una frase detta, non come si
  // chiama. Su un archivio personale una ILIKE basta e avanza.
  const scope = query
    ? and(
        eq(conversations.clientId, clientId),
        or(
          ilike(conversations.title, `%${query}%`),
          sql`${conversations.messages}::text ILIKE ${`%${query}%`}`,
        ),
      )
    : eq(conversations.clientId, clientId);

  const rows = await db
    .select({
      id: conversations.id,
      kind: conversations.kind,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(scope)
    .orderBy(desc(conversations.updatedAt));

  return Response.json({ conversations: rows });
}

export async function POST(req: Request) {
  const clientId = await getOrCreateClientId();
  const body = await req.json();
  const { id, kind, messages } = body as { id?: string; kind: "manual" | "explore"; messages: Message[] };

  if (!kind || !Array.isArray(messages)) {
    return Response.json({ error: "Payload non valido." }, { status: 400 });
  }

  const db = getDb();
  const title = deriveTitle(messages);

  if (id) {
    // Il titolo si fissa alla creazione: riscriverlo a ogni salvataggio
    // cancellerebbe le rinomine fatte dall'utente (e comunque deriva dal
    // primo messaggio, che non cambia più).
    const [row] = await db
      .update(conversations)
      .set({ messages, updatedAt: new Date() })
      .where(and(eq(conversations.id, id), eq(conversations.clientId, clientId)))
      .returning({ id: conversations.id });
    if (row) return Response.json({ id: row.id });
  }

  const [row] = await db
    .insert(conversations)
    .values({ clientId, kind, title, messages })
    .returning({ id: conversations.id });

  return Response.json({ id: row.id });
}
