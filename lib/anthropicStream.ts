import Anthropic from "@anthropic-ai/sdk";

type Msg = { role: "user" | "assistant"; content: string };

const CONTINUE_NUDGE =
  "Continua esattamente da dove ti sei interrotto, senza ripetere nulla di quanto hai già scritto sopra e senza premesse.";

/**
 * Claude 5 puo' fermarsi per max_tokens ben prima di aver scritto tutto il
 * testo visibile richiesto (una parte del budget va a ragionamento interno
 * non mostrato). Se lo stop_reason e' "max_tokens", rimanda il testo
 * parziale come turno "assistant" seguito da un turno "user" che chiede di
 * proseguire (l'API rifiuta conversazioni che finiscono in "assistant", quindi
 * niente prefill) e concateniamo il risultato.
 */
export async function streamWithContinuation(
  client: Anthropic,
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
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      system,
      messages: currentMessages,
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        full += event.delta.text;
        onDelta(event.delta.text);
      }
    }
    const finalMessage = await stream.finalMessage();
    if (finalMessage.stop_reason !== "max_tokens") break;
  }
  return full;
}
