import Anthropic from "@anthropic-ai/sdk";
import { MODEL_BLUEPRINT, MODEL_INTERVIEW, VANTAGE_SYSTEM_PROMPT } from "@/lib/vantage";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY non configurata sul server." },
      { status: 500 },
    );
  }

  const body = await req.json();
  const messages: ChatMessage[] = body.messages ?? [];
  const mode: "interview" | "blueprint" = body.mode === "blueprint" ? "blueprint" : "interview";

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Nessun messaggio fornito." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const model = mode === "blueprint" ? MODEL_BLUEPRINT : MODEL_INTERVIEW;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: mode === "blueprint" ? 16000 : 4096,
      system: VANTAGE_SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return Response.json({ text, model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto.";
    return Response.json({ error: message }, { status: 502 });
  }
}
