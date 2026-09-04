/**
 * Phone-first authentication service (Stage 2).
 *
 * Provides the account-resolution, account-creation, and combined OTP +
 * identity + session primitives used by the phone registration / sign-in server
 * actions:
 *
 *   1. resolvePhoneUser - maps a canonical E.164 phone to its linked
 *      JobEthiopia user, or null when no verified `phone` auth_account exists.
 *   2. createPhoneUser - creates a phone-first candidate (email null,
 *      passwordHash null, role CANDIDATE, isActive true), links the verified
 *      phone auth_account, and returns the new user. Duplicate phone races are
 *      resolved atomically by the DB unique constraint.
 *   3. signInWithVerifiedPhone - verifies the OTP and signs in an EXISTING
 *      phone-linked user, issuing the canonical session token.
 *   4. createPhoneAccount - verifies the OTP, creates a phone-first candidate,
 *      links the phone, and issues the canonical session token.
 *
 * The canonical phone identity is provider = "phone" with
 * providerAccountId = the normalized E.164 number (see phone.ts). name/email
 * and raw local formatting are never used to decide whether two accounts are
 * the same, and unrelated users are never auto-merged. The DB unique constraint
 * on (provider, provider_account_id) remains the final backstop against
 * duplicate identities.
 *
 * The OTP is single-use and consumed atomically (see phone-verification.ts), so
 * the code is only verified once, at the final authentication step.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { authAccounts } from "@/db/schema/authAccounts";
import { auditLog } from "@/db/schema/auditLog";
import { createSession, revokeSession } from "./session";
import { verifyOtp } from "./phone-verification";
import { writeAuditLog } from "./audit";
import { OTP_AUDIT_ACTIONS } from "./constants";
import { normalizeEthiopianPhone } from "./phone";
import type { UserRole } from "./roles";

/** A phone-first candidate's name must be supplied and non-empty. */
const NAME_MAX_LENGTH = 100;

export type PhoneUserValidation = { ok: true; name: string } | { ok: false; reason: string };

export function validatePhoneUserName(rawName: unknown): PhoneUserValidation {
  if (typeof rawName !== "string" || rawName.trim().length === 0) {
    return { ok: false, reason: "missing_name" };
  }
  const name = rawName.trim();
  if (name.length > NAME_MAX_LENGTH) {
    return { ok: false, reason: "name_too_long" };
  }
  return { ok: true, name };
}

export type ResolvePhoneUserResult =
  | {
      ok: true;
      user: { id: string; name: string; role: UserRole; isActive: boolean };
    }
  | { ok: false; reason: "invalid_phone" | "no_account" | "error" };

/**
 * Resolves a canonical E.164 phone to its linked JobEthiopia user.
 *
 * Only `auth_accounts` rows with provider = "phone" and the exact normalized
 * providerAccountId are considered. Returns no_account when the verified phone
 * identity is not linked to any user. Never auto-merges and never creates.
 */
export async function resolvePhoneUser(
  rawPhone: string,
): Promise<ResolvePhoneUserResult> {
  const phone = normalizeEthiopianPhone(rawPhone);
  if (!phone) return { ok: false, reason: "invalid_phone" };

  try {
    const account = await db.query.authAccounts.findFirst({
      where: and(
        eq(authAccounts.provider, "phone"),
        eq(authAccounts.providerAccountId, phone),
      ),
      columns: { userId: true },
    });
    if (!account) return { ok: false, reason: "no_account" };

    const user = await db.query.users.findFirst({
      where: eq(users.id, account.userId),
      columns: { id: true, name: true, role: true, isActive: true },
    });
    if (!user) return { ok: false, reason: "no_account" };

    return { ok: true, user };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export type CreatePhoneUserResult =
  | {
      ok: true;
      user: { id: string; name: string; role: UserRole; isActive: boolean };
    }
  | {
      ok: false;
      reason: "invalid_phone" | "invalid_name" | "duplicate" | "error";
    };

/**
 * Creates a phone-first candidate and links the verified phone in a single
 * transaction. The auth_accounts unique (provider, provider_account_id)
 * constraint protects against duplicate identities: if a concurrent request
 * created the same phone linkage, the transaction rolls back and the caller
 * re-resolves the existing account rather than creating a second user.
 */
export async function createPhoneUser(
  rawPhone: string,
  rawName: unknown,
): Promise<CreatePhoneUserResult> {
  const phone = normalizeEthiopianPhone(rawPhone);
  if (!phone) return { ok: false, reason: "invalid_phone" };

  const nameValidation = validatePhoneUserName(rawName);
  if (!nameValidation.ok) return { ok: false, reason: "invalid_name" };
  const name = nameValidation.name;

  try {
    const outcome = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(users)
        .values({
          name,
          email: null,
          passwordHash: null,
          role: "CANDIDATE",
          isActive: true,
        })
        .returning({ id: users.id });

      await tx.insert(authAccounts).values({
        userId: inserted.id,
        provider: "phone",
        providerAccountId: phone,
      });

      await tx.insert(auditLog).values({
        actorUserId: inserted.id,
        action: OTP_AUDIT_ACTIONS.PHONE_SIGNUP_SUCCESS,
        targetType: "user",
        targetId: inserted.id,
        metadata: { provider: "phone" },
      });

      return {
        ok: true as const,
        user: {
          id: inserted.id,
          name,
          role: "CANDIDATE" as UserRole,
          isActive: true,
        },
      };
    });

    return outcome;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("auth_accounts_provider_provider_account_id_unique") ||
        (err as { code?: unknown }).code === "23505")
    ) {
      return { ok: false, reason: "duplicate" };
    }
    return { ok: false, reason: "error" };
  }
}

export type PhoneOtpFailureReason =
  | "otp_not_found"
  | "otp_invalid"
  | "otp_expired"
  | "otp_max_attempts"
  | "otp_already_used"
  | "otp_rate_limited";

export type PhoneAuthOutcome =
  | {
      ok: true;
      rawToken: string;
      user: { id: string; name: string; role: string };
    }
  | { ok: false; reason: PhoneOtpFailureReason | "no_account" | "duplicate" | "error" };

function mapOtpFailure(reason: string): PhoneOtpFailureReason {
  switch (reason) {
    case "not_found":
      return "otp_not_found";
    case "expired":
      return "otp_expired";
    case "max_attempts":
      return "otp_max_attempts";
    case "already_used":
      return "otp_already_used";
    case "rate_limited":
      return "otp_rate_limited";
    default:
      return "otp_invalid";
  }
}

async function issueSessionAndAudit(
  userId: string,
  name: string,
  role: string,
): Promise<PhoneAuthOutcome> {
  await writeAuditLog({
    action: OTP_AUDIT_ACTIONS.PHONE_LOGIN_SUCCESS,
    actorUserId: userId,
    targetType: "user",
    targetId: userId,
    metadata: { provider: "phone" },
  });

  try {
    const rawToken = await createSession(userId);
    return { ok: true, rawToken, user: { id: userId, name, role } };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Signs in an EXISTING phone identity: verifies the OTP, resolves the linked
 * user, optionally revokes a prior session, and creates the canonical session.
 *
 * Fails opaquely if the phone has no linked account, since a login attempt must
 * never silently create an account, and must never expose whether an account
 * exists.
 */
export async function signInWithVerifiedPhone(
  requestId: string,
  code: string,
  rawPhone: string,
  options: { currentRawToken?: string; ip?: string } = {},
): Promise<PhoneAuthOutcome> {
  const phone = normalizeEthiopianPhone(rawPhone);
  if (!phone) return { ok: false, reason: "error" };

  const verification = await verifyOtp(requestId, code, { phone, ip: options.ip });
  if (!verification.ok) {
    return { ok: false, reason: mapOtpFailure(verification.reason) };
  }

  const existing = await resolvePhoneUser(phone);
  if (!existing.ok) {
    await writeAuditLog({
      action: OTP_AUDIT_ACTIONS.PHONE_LOGIN_FAILURE,
      targetType: "phone_verification",
      targetId: requestId,
      metadata: { phone, reason: "no_account" },
    });
    return { ok: false, reason: "no_account" };
  }

  if (options.currentRawToken) {
    await revokeSession(options.currentRawToken).catch(() => null);
  }

  return issueSessionAndAudit(
    existing.user.id,
    existing.user.name,
    existing.user.role,
  );
}

/**
 * Creates a NEW phone-first candidate: verifies the OTP, creates the candidate
 * user with email/passwordHash null, links the phone, and creates the canonical
 * session.
 *
 * Race handling: if another request concurrently created the same phone-linked
 * identity, the duplicate-creation transaction rolls back and we re-resolve the
 * existing account, signing that user in instead of creating a second one.
 */
export async function createPhoneAccount(
  requestId: string,
  code: string,
  rawPhone: string,
  rawName: unknown,
  options: { currentRawToken?: string; ip?: string } = {},
): Promise<PhoneAuthOutcome> {
  const phone = normalizeEthiopianPhone(rawPhone);
  if (!phone) return { ok: false, reason: "error" };

  if (!validatePhoneUserName(rawName).ok) {
    return { ok: false, reason: "error" };
  }

  const verification = await verifyOtp(requestId, code, { phone, ip: options.ip });
  if (!verification.ok) {
    return { ok: false, reason: mapOtpFailure(verification.reason) };
  }

  // Double-check the phone is not already linked (a login raced with this
  // registration). If it is, treat it as a sign-in.
  const prior = await resolvePhoneUser(phone);
  if (prior.ok) {
    if (options.currentRawToken) {
      await revokeSession(options.currentRawToken).catch(() => null);
    }
    return issueSessionAndAudit(
      prior.user.id,
      prior.user.name,
      prior.user.role,
    );
  }

  const created = await createPhoneUser(phone, rawName);
  if (!created.ok) {
    if (created.reason === "duplicate") {
      // A concurrent request created the identity; resolve and sign in the
      // winner rather than creating a second user.
      const reResolved = await resolvePhoneUser(phone);
      if (reResolved.ok) {
        if (options.currentRawToken) {
          await revokeSession(options.currentRawToken).catch(() => null);
        }
        return issueSessionAndAudit(
          reResolved.user.id,
          reResolved.user.name,
          reResolved.user.role,
        );
      }
      return { ok: false, reason: "duplicate" };
    }
    return { ok: false, reason: "error" };
  }

  return issueSessionAndAudit(
    created.user.id,
    created.user.name,
    created.user.role,
  );
}
