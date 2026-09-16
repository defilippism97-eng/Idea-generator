import Anthropic from "@anthropic-ai/sdk";
import { MODEL_BLUEPRINT, MODEL_INTERVIEW, VANTAGE_SYSTEM_PROMPT } from "@/lib/vantage";

export const runtime = "nodejs";
export const maxDuration = 300;

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

  let anthropicStream;
  try {
    anthropicStream = client.messages.stream({
      model,
      max_tokens: mode === "blueprint" ? 16000 : 4096,
      system: VANTAGE_SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto.";
    return Response.json({ error: message }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const body_stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Errore durante lo streaming.";
        controller.enqueue(encoder.encode(`\n\n[Errore: ${message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body_stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vantage-Model": model,
    },
  });
}
