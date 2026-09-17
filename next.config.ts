import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse/pdfjs-dist caricano il proprio worker con un require/import
  // dinamico che il bundler di Next riscrive rompendone la risoluzione;
  // escluderli dal bundling server li lascia usare require() nativo di Node.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
