import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { verifyPassword } from "./password";
import { createSession } from "./session";
import { writeAuditLog } from "./audit";

/**
 * Precomputed scrypt hash of a fixed non-credential password.
 *
 * When a submitted email does not exist, we still run a full scrypt
 * verification against this digest so email-lookup timing cannot be used to
 * enumerate registered accounts. The underlying value is not a real credential.
 */
const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$8eead91961399145fab4eeebf55ebbfe$73c90be53f277d16eb2bfe294507ca72b048f4199c208f938edc67ae9966e0aa19e318a2056dc2cd0465a6e3d9605c2d45af85980c7c55cd09c2c5116b835b17";

export type LoginResult =
  | { ok: true; userId: string; userEmail: string; rawToken: string }
  | { ok: false };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Core login flow: normalize email, resolve the user, verify the password,
 * create a session, and record audit events. Returns an opaque failure for
 * every incorrect path so callers never reveal whether an account exists.
 */
export async function loginUser(
  rawEmail: string,
  rawPassword: string,
): Promise<LoginResult> {
  const email = normalizeEmail(rawEmail);
  if (!email || !rawPassword) return { ok: false };

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    await verifyPassword(DUMMY_PASSWORD_HASH, rawPassword);
    await writeAuditLog({
      action: "LOGIN_FAILURE",
      targetType: "user",
      metadata: { email },
    });
    return { ok: false };
  }

  if (!user.isActive) {
    await writeAuditLog({
      action: "LOGIN_FAILURE",
      actorUserId: user.id,
      targetType: "user",
      targetId: user.id,
      metadata: { reason: "inactive" },
    });
    return { ok: false };
  }

  const valid = await verifyPassword(user.passwordHash, rawPassword);
  if (!valid) {
    await writeAuditLog({
      action: "LOGIN_FAILURE",
      actorUserId: user.id,
      targetType: "user",
      targetId: user.id,
      metadata: { reason: "wrong_password" },
    });
    return { ok: false };
  }

  const rawToken = await createSession(user.id);

  await writeAuditLog({
    action: "LOGIN_SUCCESS",
    actorUserId: user.id,
    targetType: "user",
    targetId: user.id,
  });

  return { ok: true, userId: user.id, userEmail: user.email, rawToken };
}