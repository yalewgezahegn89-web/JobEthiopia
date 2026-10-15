import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { authAccounts } from "@/db/schema/authAccounts";
import { users } from "@/db/schema/users";
import { isPgUniqueViolation } from "@/lib/pgErrors";
import { writeAuditLog } from "./audit";
import type { UserRole } from "./roles";

export interface TelegramIdentity {
  subject: string;
  name: string;
}

export interface TelegramLocalUser {
  id: string;
  role: UserRole;
  name: string;
  email: string | null;
  isActive: boolean;
}

export interface TelegramAuthenticationResult {
  user: TelegramLocalUser;
  created: boolean;
}

async function findLinkedUser(subject: string): Promise<TelegramLocalUser | null> {
  const account = await db.query.authAccounts.findFirst({
    where: and(
      eq(authAccounts.provider, "telegram"),
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
    throw new Error("TELEGRAM_ACCOUNT_UNAVAILABLE");
  }
  return user;
}

/**
 * Resolves a Telegram subject to one local account. New Telegram identities
 * can only create CANDIDATE accounts; Telegram login never grants staff roles
 * and never links accounts by display name or unverified email.
 */
export async function authenticateTelegramIdentity(
  identity: TelegramIdentity,
): Promise<TelegramAuthenticationResult> {
  const subject = identity.subject.trim();
  const name = identity.name.trim().slice(0, 100);
  if (!subject || subject.length > 128 || !name) {
    throw new Error("TELEGRAM_IDENTITY_INVALID");
  }

  const linked = await findLinkedUser(subject);
  if (linked) {
    await writeAuditLog({
      actorUserId: linked.id,
      action: "TELEGRAM_LOGIN_SUCCESS",
      targetType: "user",
      targetId: linked.id,
      metadata: { provider: "telegram" },
    });
    return { user: linked, created: false };
  }

  try {
    const user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          name,
          email: null,
          passwordHash: null,
          role: "CANDIDATE",
          isActive: true,
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
        provider: "telegram",
        providerAccountId: subject,
      });

      return created;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: "TELEGRAM_SIGNUP_SUCCESS",
      targetType: "user",
      targetId: user.id,
      metadata: { provider: "telegram" },
    });
    return { user, created: true };
  } catch (error) {
    // Two simultaneous first logins for the same Telegram subject can race.
    // The unique provider identity index remains the authority; resolve the
    // winner rather than creating or merging another account.
    if (!isPgUniqueViolation(error)) throw error;
    const racedUser = await findLinkedUser(subject);
    if (!racedUser) throw error;
    await writeAuditLog({
      actorUserId: racedUser.id,
      action: "TELEGRAM_LOGIN_SUCCESS",
      targetType: "user",
      targetId: racedUser.id,
      metadata: { provider: "telegram", recoveredConcurrentSignup: true },
    });
    return { user: racedUser, created: false };
  }
}
