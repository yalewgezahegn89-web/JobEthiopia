/**
 * Database-backed login failure tracking (Batch 3).
 *
 * Implements a sliding-window account lockout using the `login_failures` table.
 * The `account_key` is a SHA-256 hash of the normalized email — plaintext email
 * is NEVER stored in this table.
 *
 * Policy:
 *   - Each login failure inserts one row.
 *   - Count failures for same account_key within 15 minutes.
 *   - Threshold = 8 → generic LOGIN_FAILURE response (no lockout signal).
 *   - Successful login deletes all rows for that account_key.
 *   - Rows are reaped by maintenance after 24 hours.
 */

import { createHash } from "node:crypto";
import { eq, and, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginFailures } from "@/db/schema/loginFailures";
import { writeAuditLog } from "./audit";
import { normalizeEmail } from "./login";

/** Sliding window: 15 minutes. */
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** Maximum failures before the account is effectively locked. */
export const LOGIN_FAILURE_THRESHOLD = 8;

/**
 * Hashes a normalized email into the account_key used in login_failures.
 * Uses SHA-256 so plaintext email is never stored.
 */
export function hashAccountKey(normalizedEmail: string): string {
  return createHash("sha256").update(normalizedEmail).digest("hex");
}

/**
 * Records a login failure for the given email. Inserts one row into
 * login_failures with the hashed account key.
 */
export async function recordLoginFailure(
  email: string,
  options: { ip?: string } = {},
): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const accountKey = hashAccountKey(normalized);

  try {
    await db.insert(loginFailures).values({
      accountKey,
      ip: options.ip?.trim() || null,
    });
  } catch {
    // Best-effort: insert failure must not break the login flow.
  }
}

/**
 * Checks whether the account is locked (threshold exceeded within the window).
 * Returns true if the account is locked.
 */
export async function isAccountLocked(
  email: string,
  options: { now?: number } = {},
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const accountKey = hashAccountKey(normalized);
  const currentTime = options.now ?? Date.now();
  const windowStart = currentTime - LOGIN_FAILURE_WINDOW_MS;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loginFailures)
      .where(
        and(
          eq(loginFailures.accountKey, accountKey),
          gt(loginFailures.attemptedAt, new Date(windowStart)),
        ),
      )
      .limit(1);

    const count = result[0]?.count ?? 0;
    if (count >= LOGIN_FAILURE_THRESHOLD) {
      // Write lock audit (safe — no email in metadata)
      await writeAuditLog({
        action: "LOGIN_LOCKED",
        targetType: "user",
        metadata: { accountKeyHash: accountKey },
      });
      return true;
    }

    return false;
  } catch {
    // Fail-open: if we can't check, allow the attempt.
    return false;
  }
}

/**
 * Resets login failure tracking after a successful login.
 * Deletes all rows for the given account_key.
 */
export async function resetLoginFailures(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const accountKey = hashAccountKey(normalized);

  try {
    await db
      .delete(loginFailures)
      .where(eq(loginFailures.accountKey, accountKey));
  } catch {
    // Best-effort: cleanup failure must not break the login flow.
  }
}

/**
 * Reaps old login_failures rows older than the specified age.
 * Called by the maintenance pipeline.
 */
export async function reapLoginFailures(
  olderThanMs: number,
  options: { now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - olderThanMs);

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
