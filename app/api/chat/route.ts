import { createClient, streamWithFallback } from "@/lib/llmStream";
import { FALLBACK_MODELS, VANTAGE_SYSTEM_PROMPT } from "@/lib/vantage";

export const runtime = "nodejs";
export const maxDuration = 300;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Mode = "interview" | "summary" | "full";

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENROUTER_API_KEY non configurata sul server." },
      { status: 500 },
    );
  }

  const body = await req.json();
  const messages: ChatMessage[] = body.messages ?? [];
  const mode: Mode = body.mode === "summary" || body.mode === "full" ? body.mode : "interview";

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Nessun messaggio fornito." }, { status: 400 });
  }

  const client = createClient(apiKey);
  const maxTokens = mode === "full" ? 8000 : mode === "summary" ? 2048 : 4096;

  const encoder = new TextEncoder();
  let usedModel = FALLBACK_MODELS[0];
  const body_stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await streamWithFallback(
          client,
          FALLBACK_MODELS,
          maxTokens,
          VANTAGE_SYSTEM_PROMPT,
          messages.map((m) => ({ role: m.role, content: m.content })),
          (text) => controller.enqueue(encoder.encode(text)),
        );
        usedModel = result.model;
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
      "X-Vantage-Model": usedModel,
    },
  });
}
