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
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const READINESS_TIMEOUT_MS = 3_000;

/**
 * Returns true when the database answers `SELECT 1` within `timeoutMs`.
 *
 * A timeout or any query failure resolves to `false` — never throws. The
 * underlying query, if superseded by the timeout, settles later inside the
 * pool and is handled by `Promise.race` (no unhandled rejection).
 */
export async function checkDatabaseReadiness(
  timeoutMs: number = READINESS_TIMEOUT_MS,
): Promise<boolean> {
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
    return true;
  } catch {
    return false;
  }
}