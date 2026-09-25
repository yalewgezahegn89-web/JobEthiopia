/**
 * Health/readiness probe helpers (Phase 8 Batch 1).
 *
 * Liveness and readiness are intentionally separate concepts:
 *  - liveness: the application process can respond (no dependencies).
 *  - readiness: the application can serve database-dependent traffic.
 *
 * The readiness probe performs a single `SELECT 1` with a short timeout so a
 * hung database cannot stall a platform health check. Responses never include
 * database internals or error details.
 *
 * Phase 16 Batch 2: every probe is measured and recorded in the in-process
 * database metrics registry (duration + boolean outcome only), and the route
 * publishes `databaseCheckDurationMs` so operators can see probe latency
 * without a metrics backend. No connection details are ever exposed.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { recordDbProbe } from "./dbMetrics";

export const READINESS_TIMEOUT_MS = 3_000;

export interface DatabaseReadiness {
  ready: boolean;
  durationMs: number;
}

/**
 * Runs the readiness probe and returns its outcome plus how long it took.
 *
 * A timeout or any query failure resolves to `ready: false` — never throws.
 * The underlying query, if superseded by the timeout, settles later inside the
 * pool and is handled by `Promise.race` (no unhandled rejection).
 */
export async function checkDatabaseReadinessDetailed(
  timeoutMs: number = READINESS_TIMEOUT_MS,
): Promise<DatabaseReadiness> {
  const start = performance.now();
  let ready = false;
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("readiness probe timed out")),
          timeoutMs,
        );
      }),
    ]);
    ready = true;
  } catch {
    ready = false;
  }
  const raw = performance.now() - start;
  const durationMs = Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : 0;
  recordDbProbe({ ok: ready, durationMs });
  return { ready, durationMs };
}

/**
 * Returns true when the database answers `SELECT 1` within `timeoutMs`.
 * Compatibility wrapper over {@link checkDatabaseReadinessDetailed}.
 */
export async function checkDatabaseReadiness(
  timeoutMs: number = READINESS_TIMEOUT_MS,
): Promise<boolean> {
  return (await checkDatabaseReadinessDetailed(timeoutMs)).ready;
}
