import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { sessions } from "@/db/schema/sessions";
import { passwordResetTokens } from "@/db/schema/passwordResetTokens";
import { auditLog } from "@/db/schema/auditLog";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "./password";
import { writeAuditLog } from "./audit";
import { checkRateLimit } from "@/lib/rateLimit";

export const RESET_TOKEN_BYTES = 32;
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const FORGOT_LIMIT = 3;
const RESET_ATTEMPT_LIMIT = 5;
const RESET_WINDOW_MS = 15 * 60 * 1000;

export type ResetResult =
  | { ok: true }
  | { ok: false; reason: "weak" | "invalid_token" | "error" };

/**
 * Hashes a raw reset token with SHA-256. Only the hash is ever persisted or
 * compared; the raw token is never stored and never logged.
 */
export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateResetToken(): string {
  return randomBytes(RESET_TOKEN_BYTES).toString("base64url");
}

function forgotKey(normalizedEmail: string): string {
  return `reset:forgot:${normalizedEmail}`;
}

function attemptKey(tokenHash: string): string {
  return `reset:attempt:${tokenHash}`;
}

/** True when the forgot-password request is allowed for this email. */
export function forgotPasswordRateLimited(normalizedEmail: string): boolean {
  return checkRateLimit(forgotKey(normalizedEmail), {
    limit: FORGOT_LIMIT,
    windowMs: RESET_WINDOW_MS,
  }).allowed;
}

/** True when a password-reset attempt for this token is allowed. */
export function resetAttemptRateLimited(rawToken: string): boolean {
  return checkRateLimit(attemptKey(hashResetToken(rawToken)), {
    limit: RESET_ATTEMPT_LIMIT,
    windowMs: RESET_WINDOW_MS,
  }).allowed;
}

/* A static, never-matching hash used purely to burn ~one scrypt verify on the
 * unknown-email path so its cost is in the same class as the live path. */
const EQUALIZER_PASSWORD_HASH =
  "$2b$10$7EqJtq98hPqEX7fNZaFWoO5eF1a3ZbzYkPhUf9QbyCb1qW1ZLYlyS";

/** Bounded work for the unknown-email forgot path (anti-enumeration timing). */
export async function equalizeUnknownEmailWork(): Promise<void> {
  await verifyPassword(EQUALIZER_PASSWORD_HASH, generateResetToken());
}

/**
 * Creates a single-use password-reset token for an existing active user.
 *
 * Returns the raw token only to the caller (for email delivery) plus the
 * account's canonical email and the expiry. Any prior outstanding reset token
 * for the same user is removed first so only one active token exists.
 *
 * Returns null when the user does not exist or is inactive.
 */
export async function createPasswordResetToken(
  userId: string,
): Promise<{ rawToken: string; email: string; expiresAt: Date } | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, isActive: true },
  });
  if (!user || !user.isActive) {
    return null;
  }

  const rawToken = generateResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db.transaction(async (tx) => {
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await tx.insert(passwordResetTokens).values({
      userId,
      tokenHash,
      expiresAt,
    });
  });

  return { rawToken, email: user.email, expiresAt };
}

/**
 * Resolves a raw token to its owning active user, or null when the token is
 * missing, expired, already consumed, or the user is inactive. All failure
 * modes collapse to null so callers never distinguish them.
 */
export async function findValidPasswordResetToken(
  rawToken: string,
): Promise<{ userId: string; email: string } | null> {
  if (!rawToken) return null;

  const tokenHash = hashResetToken(rawToken);
  const token = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.tokenHash, tokenHash),
      gt(passwordResetTokens.expiresAt, new Date()),
    ),
  });
  if (!token) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, token.userId),
    columns: { id: true, email: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  return { userId: user.id, email: user.email };
}

/**
 * Deletes a reset token row (one-time consumption). Returns false when the
 * token does not exist.
 */
export async function consumePasswordResetToken(rawToken: string): Promise<boolean> {
  const tokenHash = hashResetToken(rawToken);
  const rows = await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .returning({ id: passwordResetTokens.id });
  return rows.length > 0;
}

/**
 * Completes a password reset atomically: validate the token, verify the user,
 * update the password hash, revoke ALL sessions, delete the token, and write a
 * PASSWORD_RESET_COMPLETED audit event — all in a single transaction.
 *
 * On any failure everything is rolled back: no session, password, token, or
 * audit change is retained, and the token is not consumed.
 *
 * Session revocation uses the same WHERE semantics as revokeSessionsForUser()
 * (delete where userId, no exclusion) but executes inside the transaction so
 * atomicity is preserved.
 */
export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string,
): Promise<ResetResult> {
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: "weak" };
  }

  if (!rawToken) {
    return { ok: false, reason: "invalid_token" };
  }

  const tokenHash = hashResetToken(rawToken);

  try {
    const outcome = await db.transaction(async (tx) => {
      const [token] = await tx
        .select({
          id: passwordResetTokens.id,
          userId: passwordResetTokens.userId,
          expiresAt: passwordResetTokens.expiresAt,
        })
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (!token) return { ok: false as const, reason: "invalid_token" as const };

      const [user] = await tx
        .select({ id: users.id, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, token.userId))
        .limit(1);
      if (!user || !user.isActive) return { ok: false as const, reason: "invalid_token" as const };

      const newHash = await hashPassword(newPassword);

      await tx
        .update(users)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      const revoked = await tx
        .delete(sessions)
        .where(eq(sessions.userId, user.id))
        .returning({ id: sessions.id });

      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash));

      await tx.insert(auditLog).values({
        actorUserId: null,
        action: "PASSWORD_RESET_COMPLETED",
        targetType: "user",
        targetId: user.id,
        metadata: { sessionsRevoked: revoked.length },
      });

      return { ok: true as const, reason: undefined as never };
    });

    if (outcome.ok) return { ok: true };
    return { ok: false, reason: outcome.reason };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Requests a password reset for a user id. Writes PASSWORD_RESET_REQUESTED only
 * for an existing active user. Returns the raw token + email for email delivery
 * or null when no active user matches.
 */
export async function requestPasswordReset(
  userId: string,
): Promise<{ rawToken: string; email: string; expiresAt: Date } | null> {
  const token = await createPasswordResetToken(userId);
  if (!token) return null;

  await writeAuditLog({
    action: "PASSWORD_RESET_REQUESTED",
    targetType: "user",
    targetId: userId,
    metadata: { requested: true },
  });

  return token;
}
