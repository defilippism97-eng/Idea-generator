import { createClient } from "@/lib/llmStream";
import { expandKbDomain } from "@/lib/kbExpand";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    return Response.json({ error: "OPENROUTER_API_KEY non configurata." }, { status: 500 });
  }

  const body = await req.json();
  const domain: string = (body.domain ?? "").trim();
  if (!domain) return Response.json({ error: "Dominio mancante." }, { status: 400 });

  const client = createClient(openrouterKey);

  try {
    const result = await expandKbDomain(client, domain);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto.";
    return Response.json({ error: message }, { status: 502 });
  }
}
