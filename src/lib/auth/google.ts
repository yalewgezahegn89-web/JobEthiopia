import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { authAccounts } from "@/db/schema/authAccounts";
import { users } from "@/db/schema/users";
import { isPgUniqueViolation } from "@/lib/pgErrors";
import { writeAuditLog } from "./audit";
import type { UserRole } from "./roles";
import { normalizeEmail } from "./login";

export interface GoogleIdentity {
  subject: string; // Google sub
  email: string;
  emailVerified: boolean;
  name?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  picture?: string | null;
}

export interface GoogleLocalUser {
  id: string;
  role: UserRole;
  name: string;
  email: string | null;
  isActive: boolean;
}

export type GoogleAuthenticationResult =
  | { ok: true; user: GoogleLocalUser; created: boolean }
  | { ok: false; reason: "email_not_verified" | "email_conflict" | "invalid_identity" };

async function findLinkedUser(subject: string): Promise<GoogleLocalUser | null> {
  const account = await db.query.authAccounts.findFirst({
    where: and(
      eq(authAccounts.provider, "google"),
      eq(authAccounts.providerAccountId, subject),
    ),
    columns: { userId: true },
  });
  if (!account) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, account.userId),
    columns: {
      id: true,
      role: true,
      name: true,
      email: true,
      isActive: true,
    },
  });
  if (!user || !user.isActive) {
    throw new Error("GOOGLE_ACCOUNT_UNAVAILABLE");
  }
  return user;
}

export function isValidGoogleEmail(value: string): boolean {
  const email = value.trim();
  if (email.length === 0 || email.length > 254) return false;
  if (/\s/.test(email)) return false;
  const parts = email.split("@");
  return parts.length === 2 && parts[0].length > 0 && parts[1].includes(".");
}

function buildDisplayName(identity: GoogleIdentity): string {
  const full = typeof identity.name === "string" ? identity.name.trim() : "";
  if (full) return full.slice(0, 100);
  const composed = [identity.givenName, identity.familyName]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
    .join(" ")
    .trim();
  if (composed) return composed.slice(0, 100);
  if (identity.email) {
    const local = identity.email.split("@")[0];
    if (local) return local.slice(0, 100);
  }
  return "Google user";
}

export async function authenticateGoogleIdentity(
  identity: GoogleIdentity,
): Promise<GoogleAuthenticationResult> {
  const subject = identity.subject.trim();
  if (!subject || subject.length > 255) {
    return { ok: false, reason: "invalid_identity" };
  }

  if (!identity.emailVerified) {
    return { ok: false, reason: "email_not_verified" };
  }

  if (!isValidGoogleEmail(identity.email)) {
    return { ok: false, reason: "invalid_identity" };
  }
  const email = normalizeEmail(identity.email);

  const linked = await findLinkedUser(subject);
  if (linked) {
    await writeAuditLog({
      actorUserId: linked.id,
      action: "GOOGLE_LOGIN_SUCCESS",
      targetType: "user",
      targetId: linked.id,
      metadata: { provider: "google" },
    });
    return { ok: true, user: linked, created: false };
  }

  // Check for existing user with same email - DO NOT link
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: {
      id: true,
      role: true,
      name: true,
      email: true,
      isActive: true,
    },
  });
  if (existingUser) {
    // Do not merge/link - return account conflict
    return { ok: false, reason: "email_conflict" };
  }

  try {
    const displayName = buildDisplayName(identity);
    const user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          name: displayName,
          email,
          passwordHash: null,
          role: "CANDIDATE",
          isActive: true,
          emailVerifiedAt: new Date(),
        })
        .returning({
          id: users.id,
          role: users.role,
          name: users.name,
          email: users.email,
          isActive: users.isActive,
        });

      await tx.insert(authAccounts).values({
        userId: created.id,
        provider: "google",
        providerAccountId: subject,
      });

      return created;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: "GOOGLE_SIGNUP_SUCCESS",
      targetType: "user",
      targetId: user.id,
      metadata: { provider: "google" },
    });
    return { ok: true, user, created: true };
  } catch (error) {
    if (!isPgUniqueViolation(error)) throw error;
    const racedUser = await findLinkedUser(subject);
    if (!racedUser) throw error;
    await writeAuditLog({
      actorUserId: racedUser.id,
      action: "GOOGLE_LOGIN_SUCCESS",
      targetType: "user",
      targetId: racedUser.id,
      metadata: { provider: "google", recoveredConcurrentSignup: true },
    });
    return { ok: true, user: racedUser, created: false };
  }
}
