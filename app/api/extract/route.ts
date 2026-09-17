import { createRequire } from "module";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

// pdf-parse v2 espone una build ESM rotta in questo contesto (Next.js/Node);
// la build CJS funziona correttamente, quindi la forziamo con createRequire.
const require = createRequire(import.meta.url);

// Nessun troncamento: il documento viene restituito per intero. Se è troppo
// lungo per la finestra del modello lo si dice esplicitamente al momento
// dell'invio, invece di tagliarlo di nascosto e far ragionare Vantage su
// metà testo senza che nessuno se ne accorga.

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Nessun file ricevuto." }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let text: string;

    if (name.endsWith(".pdf")) {
      const { PDFParse } = require("pdf-parse");
      // In Next.js/Node il worker di pdfjs-dist non si risolve da solo
      // (bundling rompe l'import relativo interno): lo puntiamo a mano.
      PDFParse.setWorker(
        path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs"),
      );
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      text = result.text;
    } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      text = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        return `# ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet)}`;
      }).join("\n\n");
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      text = buffer.toString("utf-8");
    } else {
      return Response.json(
        { error: "Formato non supportato. Usa PDF, Word (.docx), Excel/CSV o TXT." },
        { status: 400 },
      );
    }

    if (!text.trim()) {
      return Response.json({ error: "Nessun testo estraibile da questo file." }, { status: 422 });
    }

    return Response.json({ text: text.trim(), filename: file.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore durante l'estrazione.";
    return Response.json({ error: `Impossibile leggere il file: ${message}` }, { status: 500 });
  }
}
