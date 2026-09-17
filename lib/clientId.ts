import { randomUUID } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "vantage_client_id";

// Nessun login: l'archivio è associato a un id anonimo salvato in un cookie
// di lunga durata, per riconoscere lo stesso browser/dispositivo tra sessioni.
export async function getOrCreateClientId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
  });
  return id;
}
