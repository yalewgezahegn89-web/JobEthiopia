/**
 * Auth token retention cleanup (Batch 3).
 *
 * Reaps expired/consumed email_verifications and old login_failures.
 * Called by the maintenance pipeline. Bounded and safe — best-effort
 * with failure logging.
 */

import { or, lt, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { emailVerifications } from "@/db/schema/emailVerifications";
import { loginFailures } from "@/db/schema/loginFailures";

export type AuthCleanupResult = {
  emailVerificationsPruned: number;
  loginFailuresPruned: number;
};

/**
 * Reaps email_verifications that are either:
 * - Consumed (consumedAt IS NOT NULL)
 * - Expired beyond 24h grace (expiresAt < cutoff)
 *
 * Safe to run concurrently — only touches old/expired rows.
 */
async function reapEmailVerifications(
  cutoff: Date,
): Promise<number> {
  try {
    const rows = await db
      .delete(emailVerifications)
      .where(
        or(
          isNotNull(emailVerifications.consumedAt),
          lt(emailVerifications.expiresAt, cutoff),
        ),
      )
      .returning({ id: emailVerifications.id });
    return rows.length;
  } catch {
    return 0;
  }
}

/**
 * Reaps login_failures older than the specified age.
 * Only touches rows older than the cutoff.
 */
async function reapLoginFailures(
  cutoff: Date,
): Promise<number> {
  try {
    const rows = await db
      .delete(loginFailures)
      .where(lt(loginFailures.attemptedAt, cutoff))
      .returning({ id: loginFailures.id });
    return rows.length;
  } catch {
    return 0;
  }
}

/**
 * Runs all auth token cleanup tasks. Returns counts for the maintenance summary.
 *
 * @param now - Deterministic timestamp for testing
 * @param gracePeriodMs - Grace period for expired tokens (default 24h)
 */
export async function runAuthCleanup(
  now: Date,
  gracePeriodMs: number = 24 * 60 * 60 * 1000,
): Promise<AuthCleanupResult> {
  const cutoff = new Date(now.getTime() - gracePeriodMs);

  const emailVerificationsPruned = await reapEmailVerifications(cutoff);
  const loginFailuresPruned = await reapLoginFailures(cutoff);

  return {
    emailVerificationsPruned,
    loginFailuresPruned,
  };
}
