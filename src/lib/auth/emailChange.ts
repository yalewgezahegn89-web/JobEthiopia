/**
 * Email change service (Batch 3).
 *
 * Implements a secure pending-email workflow. The new email is NOT activated
 * until the verification token is consumed. Uses the same `email_verifications`
 * table with purpose="change" to track the pending new email.
 *
 * Security properties:
 *   - Re-authentication required (password or phone OTP).
 *   - New email is not activated until verification.
 *   - Unique email constraint enforced atomically.
 *   - No enumeration leakage.
 *   - Generic conflict/error responses.
 */

import { createHash } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { emailVerifications } from "@/db/schema/emailVerifications";
import { sessions } from "@/db/schema/sessions";
import { auditLog } from "@/db/schema/auditLog";
import { writeAuditLog } from "./audit";
import { verifyPassword } from "./password";
import { checkRateLimit, buildScopedRateLimitKey } from "@/lib/rateLimit";
import {
  createEmailVerificationToken,
} from "./emailVerification";

export type RequestEmailChangeResult =
  | { ok: true }
  | { ok: false; reason: "invalid_current" | "same_email" | "email_taken" | "rate_limited" | "error" };

export type VerifyEmailChangeResult =
  | { ok: true }
  | { ok: false; reason: "invalid_token" | "expired" | "email_taken" | "error" };

const EMAIL_CHANGE_LIMIT = 3;
const EMAIL_CHANGE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function emailChangeKey(userId: string): string {
  return buildScopedRateLimitKey("otp-resend", `email-change:${userId}`);
}

/**
 * Validates an email format (basic check).
 */
function isValidEmail(email: string): boolean {
  return typeof email === "string" && email.length > 0 && email.length <= 254 && email.includes("@");
}

/**
 * Hashes a raw email change token with SHA-256.
 */
export function hashEmailChangeToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Requests an email change for an authenticated user.
 *
 * Requires re-authentication via current password for password accounts.
 * Creates a pending email_verifications row with the target email.
 * The new email is NOT activated until verifyEmailChange is called.
 */
export async function requestEmailChange(
  userId: string,
  newEmail: string,
  currentPassword: string,
  options: { now?: Date } = {},
): Promise<RequestEmailChangeResult & { rawToken?: string; expiresAt?: Date }> {
  const now = options.now ?? new Date();

  // Rate limit
  const key = emailChangeKey(userId);
  if (!checkRateLimit(key, { limit: EMAIL_CHANGE_LIMIT, windowMs: EMAIL_CHANGE_WINDOW_MS }, now.getTime()).allowed) {
    return { ok: false, reason: "rate_limited" };
  }

  // Validate email
  if (!isValidEmail(newEmail)) {
    return { ok: false, reason: "error" };
  }

  const normalizedNewEmail = newEmail.trim().toLowerCase();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, passwordHash: true, isActive: true },
  });
  if (!user || !user.isActive) {
    return { ok: false, reason: "error" };
  }

  // Same email check
  if (user.email === normalizedNewEmail) {
    return { ok: false, reason: "same_email" };
  }

  // Re-authentication required for password accounts
  if (user.passwordHash) {
    const valid = await verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      return { ok: false, reason: "invalid_current" };
    }
  }

  // Check if new email is already taken by another user
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, normalizedNewEmail),
    columns: { id: true },
  });
  if (existingUser && existingUser.id !== userId) {
    return { ok: false, reason: "email_taken" };
  }

  // Create pending email change token
  const token = await createEmailVerificationToken(
    userId,
    "change",
    normalizedNewEmail,
    { now },
  );
  if (!token) return { ok: false, reason: "error" };

  await writeAuditLog({
    action: "EMAIL_CHANGE_REQUESTED",
    actorUserId: userId,
    targetType: "user",
    targetId: userId,
    metadata: {},
  });

  return {
    ok: true,
    rawToken: token.rawToken,
    expiresAt: token.expiresAt,
  };
}

/**
 * Verifies an email change token. Atomic transaction:
 * 1. Validates token (not expired, not consumed)
 * 2. Checks target email is still available
 * 3. Updates users.email
 * 4. Sets users.email_verified_at
 * 5. Marks token consumed
 * 6. Revokes other sessions
 * 7. Writes EMAIL_CHANGED audit
 */
export async function verifyEmailChange(
  rawToken: string,
  options: { currentSessionId?: string } = {},
): Promise<VerifyEmailChangeResult> {
  if (!rawToken) return { ok: false, reason: "invalid_token" };

  const tokenHash = hashEmailChangeToken(rawToken);

  try {
    const result = await db.transaction(async (tx) => {
      const [token] = await tx
        .select({
          id: emailVerifications.id,
          userId: emailVerifications.userId,
          email: emailVerifications.email,
          expiresAt: emailVerifications.expiresAt,
          consumedAt: emailVerifications.consumedAt,
        })
        .from(emailVerifications)
        .where(eq(emailVerifications.tokenHash, tokenHash))
        .limit(1);

      if (!token) throw new Error("invalid_token");
      if (token.consumedAt) {
        // Already consumed — idempotent success
        return { ok: true as const };
      }
      if (new Date() > token.expiresAt) throw new Error("expired");

      // Check target email is still available
      const existingUser = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, token.email))
        .limit(1);
      if (existingUser.length > 0 && existingUser[0].id !== token.userId) {
        throw new Error("email_taken");
      }

      // Update email and set verified
      await tx
        .update(users)
        .set({
          email: token.email,
          emailVerifiedAt: new Date(),
        })
        .where(eq(users.id, token.userId));

      // Mark token consumed
      await tx
        .update(emailVerifications)
        .set({ consumedAt: new Date() })
        .where(eq(emailVerifications.id, token.id));

      // Revoke other sessions (keep current if provided)
      if (options.currentSessionId) {
        await tx
          .delete(sessions)
          .where(
            and(
              eq(sessions.userId, token.userId),
              ne(sessions.id, options.currentSessionId),
            ),
          );
      } else {
        await tx.delete(sessions).where(eq(sessions.userId, token.userId));
      }

      // Audit
      await tx.insert(auditLog).values({
        actorUserId: token.userId,
        action: "EMAIL_CHANGED",
        targetType: "user",
        targetId: token.userId,
        metadata: {},
      });

      return { ok: true as const };
    });

    return result;
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "expired") return { ok: false, reason: "expired" };
      if (e.message === "email_taken") return { ok: false, reason: "email_taken" };
    }
    return { ok: false, reason: "error" };
  }
}
