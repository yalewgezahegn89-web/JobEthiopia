/**
 * pg_trgm capability probe (Phase 8 Batch 2).
 *
 * Tier selection is never assumed: when the extension is present AND the
 * database reports it enabled, trigram-based ranking may be used; otherwise
 * the safe substring tier runs. The check is performed at most once per
 * process and can be forced off with DISABLE_PG_TRGM=true (e.g. in tests or
 * before the extension has been deployed).
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";

type TrgmProbeClient = {
  execute: (query: ReturnType<typeof sql>) => Promise<{
    rows?: Array<{ available?: unknown }>;
  }>;
};

let cached: boolean | null = null;

export function resetTrgmAvailabilityForTests(): void {
  cached = null;
}

export async function isPgTrgmAvailable(
  client: TrgmProbeClient = db as TrgmProbeClient,
): Promise<boolean> {
  if (cached !== null) return cached;

  if (process.env.DISABLE_PG_TRGM === "true") {
    cached = false;
    return cached;
  }

  try {
    const result = await client.execute(
      sql`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS available`,
    );
    cached = result.rows?.[0]?.available === true;
  } catch {
    cached = false;
  }
  return cached;
}