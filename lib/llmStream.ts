import OpenAI from "openai";

type Msg = { role: "user" | "assistant"; content: string };

export function createClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://vantage-agent.vercel.app",
      "X-Title": "Vantage",
    },
  });
}

const CONTINUE_NUDGE =
  "Continua esattamente da dove ti sei interrotto, senza ripetere nulla di quanto hai già scritto sopra e senza premesse.";

/**
 * I modelli possono fermarsi per max_tokens ben prima di aver scritto tutto
 * il testo richiesto. Se finish_reason è "length", rimanda il testo parziale
 * come turno "assistant" seguito da un turno "user" che chiede di
 * proseguire, e concateniamo il risultato invece di lasciare l'output tagliato.
 */
export async function streamWithContinuation(
  client: OpenAI,
  model: string,
  maxTokens: number,
  system: string,
  messages: Msg[],
  onDelta: (text: string) => void,
  maxContinuations = 3,
): Promise<string> {
  let full = "";
  for (let attempt = 0; attempt <= maxContinuations; attempt++) {
    const currentMessages: Msg[] =
      attempt === 0
        ? messages
        : [...messages, { role: "assistant", content: full }, { role: "user", content: CONTINUE_NUDGE }];

    const stream = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      stream: true,
      messages: [{ role: "system", content: system }, ...currentMessages],
    });

    let finishReason: string | null = null;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        full += delta;
        onDelta(delta);
      }
      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }
    }
    if (finishReason !== "length") break;
  }
  return full;
}
