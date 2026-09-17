import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ text, variant }: { text: string; variant?: "chat" | "doc" }) {
  return (
    <div className={`prose-vantage ${variant === "doc" ? "prose-doc" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
