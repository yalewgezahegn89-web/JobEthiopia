/**
 * Phone change service (Batch 3).
 *
 * Implements phone number change via OTP verification of the new phone,
 * followed by an atomic transactional swap of the auth_accounts row.
 *
 * Security properties:
 *   - No new schema required (uses existing auth_accounts).
 *   - New phone is verified via existing OTP infrastructure.
 *   - Atomic transactional swap.
 *   - Unique phone identity constraint preserved.
 *   - No enumeration leakage.
 *   - No raw phone in audit metadata.
 *   - No insecure GET mutation.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { authAccounts } from "@/db/schema/authAccounts";
import { candidateProfiles } from "@/db/schema/candidateProfiles";
import { auditLog } from "@/db/schema/auditLog";
import { normalizeEthiopianPhone, type EthiopianPhone } from "./phone";
import { requestOtp, verifyOtp } from "./phone-verification";

export type RequestPhoneChangeResult =
  | { ok: true; requestId: string; phone: EthiopianPhone }
  | { ok: false; reason: "invalid_phone" | "no_account" | "rate_limited" | "duplicate" | "error" };

export type VerifyPhoneChangeResult =
  | { ok: true }
  | { ok: false; reason: "otp_invalid" | "otp_expired" | "otp_max_attempts" | "otp_already_used" | "duplicate" | "error" };

/**
 * Requests a phone change for an authenticated user.
 * Initiates OTP verification for the new phone number.
 */
export async function requestPhoneChange(
  userId: string,
  rawNewPhone: string,
  options: { ip?: string } = {},
): Promise<RequestPhoneChangeResult> {
  const phone = normalizeEthiopianPhone(rawNewPhone);
  if (!phone) return { ok: false, reason: "invalid_phone" };

  // Check user exists
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, isActive: true },
  });
  if (!user || !user.isActive) {
    return { ok: false, reason: "no_account" };
  }

  // Check new phone is not already assigned to another account
  const existingAccount = await db.query.authAccounts.findFirst({
    where: and(
      eq(authAccounts.provider, "phone"),
      eq(authAccounts.providerAccountId, phone),
    ),
    columns: { id: true, userId: true },
  });
  if (existingAccount && existingAccount.userId !== userId) {
    return { ok: false, reason: "duplicate" };
  }

  // Request OTP for the new phone
  const result = await requestOtp(rawNewPhone, {
    ip: options.ip,
    userId,
  });
  if (!result.ok) {
    if (result.reason === "rate_limited" || result.reason === "resend_too_soon") {
      return { ok: false, reason: "rate_limited" };
    }
    return { ok: false, reason: "error" };
  }

  return { ok: true, requestId: result.requestId, phone: result.phone };
}

/**
 * Verifies the OTP and completes the phone change atomically.
 *
 * Transaction:
 * 1. Verify OTP
 * 2. Ensure new phone is not already assigned
 * 3. Delete old phone auth_accounts row
 * 4. Insert new phone auth_accounts row
 * 5. Update candidate_profiles.phone
 * 6. Write PHONE_CHANGED audit
 */
export async function verifyPhoneChange(
  userId: string,
  requestId: string,
  code: string,
  options: { ip?: string } = {},
): Promise<VerifyPhoneChangeResult> {
  // Verify OTP
  const verification = await verifyOtp(requestId, code, { ip: options.ip });
  if (!verification.ok) {
    const reason = verification.reason === "not_found" ? "otp_invalid"
      : verification.reason === "expired" ? "otp_expired"
      : verification.reason === "max_attempts" ? "otp_max_attempts"
      : verification.reason === "already_used" ? "otp_already_used"
      : "otp_invalid";
    return { ok: false, reason };
  }

  const newPhone = verification.phone;

  try {
    await db.transaction(async (tx) => {
      // Check new phone is not already assigned
      const existing = await tx
        .select({ id: authAccounts.id, userId: authAccounts.userId })
        .from(authAccounts)
        .where(
          and(
            eq(authAccounts.provider, "phone"),
            eq(authAccounts.providerAccountId, newPhone),
          ),
        )
        .limit(1);

      if (existing.length > 0 && existing[0].userId !== userId) {
        throw new Error("duplicate");
      }

      // Delete old phone auth_accounts row
      await tx
        .delete(authAccounts)
        .where(
          and(
            eq(authAccounts.userId, userId),
            eq(authAccounts.provider, "phone"),
          ),
        );

      // Insert new phone auth_accounts row
      await tx.insert(authAccounts).values({
        userId,
        provider: "phone",
        providerAccountId: newPhone,
      });

      // Update candidate_profiles.phone
      await tx
        .update(candidateProfiles)
        .set({ phone: newPhone })
        .where(eq(candidateProfiles.candidateId, userId));

      // Audit (no raw phone in metadata)
      await tx.insert(auditLog).values({
        actorUserId: userId,
        action: "PHONE_CHANGED",
        targetType: "user",
        targetId: userId,
        metadata: { provider: "phone" },
      });
    });

    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "duplicate") {
      return { ok: false, reason: "duplicate" };
    }
    return { ok: false, reason: "error" };
  }
}
