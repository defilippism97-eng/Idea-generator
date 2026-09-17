import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type Reference = { n: number; title: string; url: string | null };

/**
 * Trasforma i riferimenti [n] in link interni, che il renderer qui sotto
 * riconosce e disegna come note. Salta i blocchi di codice: in un prompt di
 * sviluppo un "[1]" può essere un indice di array, non una citazione.
 */
function linkifyCitations(text: string, references: Reference[]): string {
  if (references.length === 0) return text;
  const valid = new Set(references.map((r) => r.n));

  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((chunk, i) =>
      i % 2 === 1
        ? chunk
        : chunk.replace(/\[(\d+)\]/g, (match, digits) =>
            valid.has(Number(digits)) ? `[${digits}](#rif-${digits})` : match,
          ),
    )
    .join("");
}

export function Markdown({
  text,
  variant,
  references = [],
}: {
  text: string;
  variant?: "chat" | "doc";
  references?: Reference[];
}) {
  return (
    <div className={`prose-vantage ${variant === "doc" ? "prose-doc" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            const marker = typeof href === "string" ? href.match(/^#rif-(\d+)$/) : null;
            if (!marker) {
              return (
                <a href={href} {...props}>
                  {children}
                </a>
              );
            }
            const reference = references.find((r) => r.n === Number(marker[1]));
            if (!reference) return <>{children}</>;
            // Un documento caricato dall'utente non ha un link da aprire:
            // resta una nota, ma non cliccabile.
            if (!reference.url) {
              return (
                <span className="citation" title={`${reference.title} — documento caricato`}>
                  {reference.n}
                </span>
              );
            }
            return (
              <a
                className="citation"
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                title={reference.title}
              >
                {reference.n}
              </a>
            );
          },
        }}
      >
        {linkifyCitations(text, references)}
      </ReactMarkdown>
    </div>
  );
}

/** I riferimenti effettivamente citati in un testo, in ordine. */
export function citedIn(text: string, references: Reference[]): Reference[] {
  return references.filter((r) => new RegExp(`\\[${r.n}\\]`).test(text));
}
