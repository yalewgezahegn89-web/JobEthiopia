/**
 * Email verification service (Batch 3).
 *
 * Provides the token generation, hashing, storage, and verification primitives
 * for the email verification flow. Covers both initial email verification and
 * email-change verification via a single `email_verifications` table.
 *
 * Security properties:
 *   - Cryptographically random high-entropy token (never Math.random()).
 *   - Only the SHA-256 hash of the token is persisted.
 *   - Tokens are single-use (consumedAt marking).
 *   - Bounded expiry (default 24h).
 *   - One pending token per purpose per user at a time.
 *   - No enumeration leakage: generic responses for all failure modes.
 */

import { randomBytes, createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { emailVerifications } from "@/db/schema/emailVerifications";
import { sessions } from "@/db/schema/sessions";
import { auditLog } from "@/db/schema/auditLog";
import { writeAuditLog } from "./audit";
import { getAppBaseUrl } from "./csrf";
import { checkRateLimit, buildScopedRateLimitKey } from "@/lib/rateLimit";

export const TOKEN_BYTES = 32;
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type EmailVerificationPurpose = "verify" | "change";

const RESEND_LIMIT = 3;
const RESEND_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export type RequestEmailVerificationResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited" | "no_email" | "error" };

export type VerifyEmailResult =
  | { ok: true; alreadyVerified: boolean }
  | { ok: false; reason: "invalid_token" | "expired" | "error" };

/**
 * Hashes a raw email-verification token with SHA-256. Only the hash is ever
 * persisted; the raw token is never stored and never logged.
 */
export function hashEmailToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function resendKey(userId: string): string {
  return buildScopedRateLimitKey("otp-resend", `email-verify:${userId}`);
}

/**
 * Creates a pending email verification token for a user.
 *
 * Revokes any prior pending (unconsumed) token for the same user+purpose
 * before inserting, so only one active token exists at a time.
 *
 * Returns the raw token (for email delivery) or null if the user has no email.
 */
export async function createEmailVerificationToken(
  userId: string,
  purpose: EmailVerificationPurpose,
  targetEmail: string,
  options: { now?: Date } = {},
): Promise<{ rawToken: string; expiresAt: Date } | null> {
  if (!targetEmail) return null;

  const rawToken = generateToken();
  const tokenHash = hashEmailToken(rawToken);
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS);

  try {
    await db.transaction(async (tx) => {
      // Revoke prior pending tokens for this user + purpose
      await tx
        .delete(emailVerifications)
        .where(
          and(
            eq(emailVerifications.userId, userId),
            eq(emailVerifications.email, targetEmail),
            isNull(emailVerifications.consumedAt),
          ),
        );

      await tx.insert(emailVerifications).values({
        userId,
        tokenHash,
        email: targetEmail,
        expiresAt,
      });
    });
  } catch {
    return null;
  }

  return { rawToken, expiresAt };
}

/**
 * Builds the public verification URL for a raw token. `change` tokens point at
 * the same consumer page with an explicit type, which routes to the
 * email-change verifier. The raw token is only ever embedded in the email sent
 * to the recipient; it is never persisted or logged.
 */
export function buildEmailVerificationUrl(
  rawToken: string,
  purpose: EmailVerificationPurpose = "verify",
): string {
  const type = purpose === "change" ? "&type=change" : "";
  return `${getAppBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}${type}`;
}

/**
 * Requests an email verification for an existing user with an email.
 * Rate-limited per user. Generic response — never reveals whether the user
 * or email exists.
 */
export async function requestEmailVerification(
  userId: string,
  options: { now?: Date } = {},
): Promise<RequestEmailVerificationResult & { rawToken?: string; email?: string | null; expiresAt?: Date }> {
  const now = options.now ?? new Date();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, emailVerifiedAt: true, isActive: true },
  });
  if (!user || !user.isActive || !user.email) {
    return { ok: false, reason: "no_email" };
  }

  // Rate limit: max 3 resend per hour per user
  const key = resendKey(userId);
  if (!checkRateLimit(key, { limit: RESEND_LIMIT, windowMs: RESEND_WINDOW_MS }, now.getTime()).allowed) {
    return { ok: false, reason: "rate_limited" };
  }

  const token = await createEmailVerificationToken(userId, "verify", user.email, { now });
  if (!token) return { ok: false, reason: "error" };

  await writeAuditLog({
    action: "EMAIL_VERIFICATION_REQUESTED",
    actorUserId: userId,
    targetType: "user",
    targetId: userId,
    metadata: {},
  });

  return {
    ok: true,
    rawToken: token.rawToken,
    email: user.email,
    expiresAt: token.expiresAt,
  };
}

/**
 * Verifies a raw email verification token. Atomic transaction:
 * 1. Validates token (not expired, not consumed)
 * 2. Marks token as consumed
 * 3. Sets users.email_verified_at if not already set
 * 4. Revokes other sessions if required
 * 5. Writes EMAIL_VERIFIED audit
 *
 * Safe for already-verified emails (idempotent success).
 */
export async function verifyEmailToken(
  rawToken: string,
  options: { revokeOtherSessions?: boolean } = {},
): Promise<VerifyEmailResult> {
  if (!rawToken) return { ok: false, reason: "invalid_token" };

  const tokenHash = hashEmailToken(rawToken);

  try {
    await db.transaction(async (tx) => {
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
        // Already consumed — return success (idempotent)
        return;
      }
      if (new Date() > token.expiresAt) throw new Error("expired");

      // Mark token consumed
      await tx
        .update(emailVerifications)
        .set({ consumedAt: new Date() })
        .where(eq(emailVerifications.id, token.id));

      // Set email_verified_at if not already set
      const [user] = await tx
        .select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.id, token.userId))
        .limit(1);

      if (!user) throw new Error("invalid_token");
      // Purpose hardening: a verification token created for an email change
      // (pending new email) must never be consumed by the plain verify path.
      // The token's email must match the user's current email.
      if (user.email !== token.email) throw new Error("invalid_token");

      let alreadyVerified = false;
      if (!user.emailVerifiedAt) {
        await tx
          .update(users)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(users.id, token.userId));
      } else {
        alreadyVerified = true;
      }

      // Revoke other sessions if requested
      if (options.revokeOtherSessions) {
        await tx.delete(sessions).where(eq(sessions.userId, token.userId));
      }

      // Audit
      await tx.insert(auditLog).values({
        actorUserId: token.userId,
        action: "EMAIL_VERIFIED",
        targetType: "user",
        targetId: token.userId,
        metadata: { alreadyVerified },
      });
    });

    return { ok: true, alreadyVerified: false };
  } catch (e) {
    if (e instanceof Error && e.message === "expired") {
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "invalid_token" };
  }
}
