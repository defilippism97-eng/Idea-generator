import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Registro "documento": usato solo per gli artefatti consegnabili (Sintesi
// Esecutiva, MVP Completo), per marcare visivamente il salto da
// conversazione a specifica tecnica.
const docFont = IBM_Plex_Mono({
  variable: "--font-doc",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Vantage — Venture Architect",
  description: "Agente per profilazione e generazione di MVP blueprint ad alto valore aggiunto.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${bodyFont.variable} ${displayFont.variable} ${docFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
