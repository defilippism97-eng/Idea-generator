import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Supporta sia DATABASE_URL (locale) sia le variabili che Vercel Postgres
// inietta automaticamente quando colleghi un database dal tab Storage.
const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;

let cached: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!connectionString) {
    throw new Error("Nessun database configurato (DATABASE_URL / POSTGRES_URL mancante).");
  }
  if (!cached) {
    const client = postgres(connectionString, { max: 1 });
    cached = drizzle(client, { schema });
  }
  return cached;
}
