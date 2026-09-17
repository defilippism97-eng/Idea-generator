import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kbExpansionJobs } from "@/lib/db/schema";

export const runtime = "nodejs";

const STALE_GRACE_MS = 3 * 60_000;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [job] = await db.select().from(kbExpansionJobs).where(eq(kbExpansionJobs.id, id)).limit(1);
  if (!job) return Response.json({ error: "Job non trovato." }, { status: 404 });

  // Vedi reapStaleJobs in /api/kb/schedule: un job "running" il cui processo
  // e' morto prima di segnare lo stato finale resterebbe cosi' per sempre.
  if (job.status === "running" && job.endsAt.getTime() + STALE_GRACE_MS < Date.now()) {
    await db.update(kbExpansionJobs).set({ status: "error" }).where(eq(kbExpansionJobs.id, id));
    job.status = "error";
  }

  return Response.json({ job });
}
