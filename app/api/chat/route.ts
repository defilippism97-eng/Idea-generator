import Anthropic from "@anthropic-ai/sdk";
import { streamWithContinuation } from "@/lib/anthropicStream";
import { MODEL_INTERVIEW, MODEL_SYNTHESIS, VANTAGE_SYSTEM_PROMPT } from "@/lib/vantage";

export const runtime = "nodejs";
export const maxDuration = 300;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Mode = "interview" | "summary" | "full";

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
  const mode: Mode = body.mode === "summary" || body.mode === "full" ? body.mode : "interview";

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Nessun messaggio fornito." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const model = mode === "interview" ? MODEL_INTERVIEW : MODEL_SYNTHESIS;
  const maxTokens = mode === "full" ? 8000 : mode === "summary" ? 2048 : 4096;

  const encoder = new TextEncoder();
  const body_stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await streamWithContinuation(
          client,
          model,
          maxTokens,
          VANTAGE_SYSTEM_PROMPT,
          messages.map((m) => ({ role: m.role, content: m.content })),
          (text) => controller.enqueue(encoder.encode(text)),
        );
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
