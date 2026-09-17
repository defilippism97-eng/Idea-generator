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

// Applica il tema salvato prima del primo paint, per non mostrare un lampo
// del tema scuro a chi ha scelto quello chiaro.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('vantage-theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      data-theme="dark"
      className={`${bodyFont.variable} ${displayFont.variable} ${docFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
