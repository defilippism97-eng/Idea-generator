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

/**
 * Prova ogni modello della lista in ordine di preferenza, passando al
 * successivo se quello corrente va in errore (rate limit esaurito, modello
 * rimosso/non disponibile, timeout, ecc.). Tutti i modelli della lista sono
 * gratuiti: l'app resta sempre a costo zero anche quando un modello smette
 * di funzionare, senza bisogno di un monitoraggio esterno.
 */
export async function streamWithFallback(
  client: OpenAI,
  models: string[],
  maxTokens: number,
  system: string,
  messages: Msg[],
  onDelta: (text: string) => void,
  maxContinuations = 3,
  onModelSwitch?: (model: string, attempt: number) => void,
): Promise<{ text: string; model: string }> {
  let lastError: unknown = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    onModelSwitch?.(model, i);
    try {
      const text = await streamWithContinuation(
        client,
        model,
        maxTokens,
        system,
        messages,
        onDelta,
        maxContinuations,
      );
      if (text.trim()) return { text, model };
      lastError = new Error(`${model}: nessuna risposta generata.`);
    } catch (err) {
      lastError = err;
    }
  }
  const message = lastError instanceof Error ? lastError.message : "Errore sconosciuto.";
  throw new Error(`Tutti i modelli gratuiti disponibili hanno fallito. Ultimo errore: ${message}`);
}
