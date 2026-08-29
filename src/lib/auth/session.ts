import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema/sessions";
import { users } from "@/db/schema/users";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "./constants";
import type { AuthUser } from "./roles";

export { SESSION_COOKIE_NAME, SESSION_DURATION_MS };

const TOKEN_BYTES = 32;

/**
 * Hashes the raw session token with SHA-256. Only the hash is persisted;
 * the raw token is never stored and never compared via SQL with the raw value.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a session for the given user id and returns the raw token.
 * Only the token hash is persisted.
 */
export async function createSession(userId: string): Promise<string> {
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return rawToken;
}

/**
 * Verifies a raw session token and resolves the authenticated user.
 *
 * Returns null when: token missing, session not found, session expired,
 * user missing, or user inactive. Inactive-user sessions are revoked.
 * Update of lastUsedAt is best-effort and never invalidates the session.
 */
export async function verifySession(rawToken: string): Promise<AuthUser | null> {
  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.tokenHash, tokenHash),
      gt(sessions.expiresAt, new Date()),
    ),
  });
  if (!session) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  if (!user || !user.isActive) {
    await db
      .delete(sessions)
      .where(eq(sessions.id, session.id))
      .catch(() => undefined);
    return null;
  }

  await db
    .update(sessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(sessions.id, session.id))
    .catch(() => undefined);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/**
 * Revokes a session by its raw token. Returns the owning user id when the
 * session existed, otherwise null. Safe to call when already logged out.
 */
export async function revokeSession(rawToken: string): Promise<string | null> {
  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);
  const [existing] = await db
    .select({ id: sessions.id, userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  if (!existing) return null;

  await db.delete(sessions).where(eq(sessions.id, existing.id));
  return existing.userId;
}