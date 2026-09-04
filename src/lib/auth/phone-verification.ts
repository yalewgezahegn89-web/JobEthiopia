/**
 * Phone OTP verification service (Stage 1, foundational).
 *
 * This service persists OTP issuances, enforces quick expiry + bounded
 * attempts via the otp module, applies rate limits via the shared limiter,
 * writes audit events via the existing audit infrastructure, and exposes a
 * reusable primitive for linking a verified phone to a local user.
 *
 * SMS transport is deliberately NOT wired here. The caller passes an optional
 * `deliver` callback (e.g. Ethio telecom / Safaricom Ethiopia / other SMS
 * adapter). The service never stores, logs, or returns the raw code to
 * consumers outside of that callback.
 */

import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { phoneVerifications } from "@/db/schema/phoneVerifications";
import { authAccounts } from "@/db/schema/authAccounts";
import { users } from "@/db/schema/users";
import { normalizeEthiopianPhone, type EthiopianPhone } from "./phone";
import {
  generateOtpCode,
  hashOtp,
  evaluateOtp,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "./otp";
import { OTP_AUDIT_ACTIONS } from "./constants";
import { writeAuditLog } from "./audit";
import { checkRateLimit, buildScopedRateLimitKey } from "@/lib/rateLimit";

/** OTP delivery transport. Raw codes only flow through this callback. */
export type OtpDelivery = (params: {
  phone: EthiopianPhone;
  code: string;
  requestId: string;
}) => Promise<void>;

const REQUEST_PER_PHONE = { limit: 5, windowMs: 60 * 60 * 1000 };
const REQUEST_PER_IP = { limit: 10, windowMs: 60 * 60 * 1000 };
const VERIFY_PER_PHONE = { limit: 10, windowMs: 15 * 60 * 1000 };
const VERIFY_PER_REQUEST = { limit: 15, windowMs: 15 * 60 * 1000 };

export type RequestOtpResult =
  | { ok: true; requestId: string; phone: EthiopianPhone }
  | { ok: false; reason: "invalid_phone" | "rate_limited" | "resend_too_soon" | "error" };

export type VerifyOtpResult =
  | { ok: true; phone: EthiopianPhone; userId: string | null }
  | {
      ok: false;
      reason:
        | "not_found"
        | "already_used"
        | "expired"
        | "max_attempts"
        | "invalid"
        | "rate_limited";
    };

export type LinkPhoneResult =
  | { ok: true; linked: boolean }
  | {
      ok: false;
      reason: "invalid_phone" | "duplicate" | "no_verified_phone" | "error";
    };

/**
 * Requests (issues) a new OTP for a verified-capable Ethiopian phone number.
 *
 * - Normalizes the phone server-side.
 * - Applies per-phone, per-IP, and resend-cooldown controls.
 * - Persists only the OTP hash.
 * - Writes an OTP_REQUESTED audit event (never the code).
 *
 * `deliver` is the (future) SMS transport hook; omit it when no provider is
 * configured. Successful verification later is independent of delivery.
 */
export async function requestOtp(
  rawPhone: string,
  options: {
    deliver?: OtpDelivery;
    ip?: string;
    userId?: string | null;
    now?: number;
  } = {},
): Promise<RequestOtpResult> {
  const phone = normalizeEthiopianPhone(rawPhone);
  if (!phone) return { ok: false, reason: "invalid_phone" };

  const currentTime = options.now ?? Date.now();

  // Per-phone and per-request-source usage caps.
  const phoneKey = buildScopedRateLimitKey("otp-request", phone);
  if (!checkRateLimit(phoneKey, REQUEST_PER_PHONE, currentTime).allowed) {
    return { ok: false, reason: "rate_limited" };
  }
  const ip = options.ip?.trim();
  if (ip) {
    const ipKey = buildScopedRateLimitKey("otp-request", ip);
    if (!checkRateLimit(ipKey, REQUEST_PER_IP, currentTime).allowed) {
      return { ok: false, reason: "rate_limited" };
    }
  }

  // Resend cooldown bucket: bound how often a new code can be issued for the
  // same phone beyond the DB-observed cooldown window.
  const resendKey = buildScopedRateLimitKey("otp-resend", phone);
  if (!checkRateLimit(resendKey, { limit: 1, windowMs: OTP_RESEND_COOLDOWN_MS }, currentTime).allowed) {
    return { ok: false, reason: "resend_too_soon" };
  }

  // Resend cooldown: the most recent active issuance must be older than the
  // cooldown window before a new code can be requested.
  const recent = await db.query.phoneVerifications.findFirst({
    where: and(
      eq(phoneVerifications.phoneNumber, phone),
      isNull(phoneVerifications.verifiedAt),
      gt(phoneVerifications.createdAt, new Date(currentTime - OTP_RESEND_COOLDOWN_MS)),
    ),
    orderBy: (t) => [desc(t.createdAt)],
  });
  if (recent) return { ok: false, reason: "resend_too_soon" };

  const code = generateOtpCode();
  const otpHash = await hashOtp(code);
  const expiresAt = new Date(currentTime + OTP_TTL_MS);

  let requestId: string;
  try {
    const [inserted] = await db
      .insert(phoneVerifications)
      .values({
        userId: options.userId ?? null,
        phoneNumber: phone,
        otpHash,
        expiresAt,
        attempts: 0,
      })
      .returning({ id: phoneVerifications.id });
    requestId = inserted.id;
  } catch {
    return { ok: false, reason: "error" };
  }

  if (options.deliver) {
    try {
      await options.deliver({ phone, code, requestId });
    } catch {
      // Delivery failure is captured in audit metadata but never exposes the code.
      await writeAuditLog({
        action: OTP_AUDIT_ACTIONS.OTP_REQUESTED,
        actorUserId: options.userId ?? null,
        targetType: "phone_verification",
        targetId: requestId,
        metadata: { phone, delivery: "failed" },
      });
      return { ok: false, reason: "error" };
    }
  }

  await writeAuditLog({
    action: OTP_AUDIT_ACTIONS.OTP_REQUESTED,
    actorUserId: options.userId ?? null,
    targetType: "phone_verification",
    targetId: requestId,
    metadata: { phone, delivery: options.deliver ? "dispatched" : "none" },
  });

  return { ok: true, requestId, phone };
}

/**
 * Verifies a submitted OTP code against a persisted request.
 *
 * Enforces: exists, not already used, not expired, within max attempts, and
 * correctness. Increments the attempt counter on failures. Writes
 * OTP_VERIFIED / OTP_FAILED audit events (never the code).
 *
 * Atomicity: the verifiedAt null -> timestamp transition is performed as a
 * single conditional UPDATE (WHERE verifiedAt IS NULL) so that when two
 * concurrent requests submit the same correct code, the database permits only
 * one of them to consume it. The loser observes zero rows updated and is
 * treated as "already_used" rather than re-verifying or double-consuming.
 *
 * Rate limiting: applies the otp-verify bucket scoped by phone and by request
 * identity, so verification attempts are bounded independently of the
 * per-record attempt counter.
 */
export async function verifyOtp(
  requestId: string,
  codeValue: string,
  options: { now?: number; phone?: string; ip?: string } = {},
): Promise<VerifyOtpResult> {
  const currentTime = options.now ?? Date.now();

  const record = await db.query.phoneVerifications.findFirst({
    where: eq(phoneVerifications.id, requestId),
  });
  if (!record) return { ok: false, reason: "not_found" };
  if (record.verifiedAt) return { ok: false, reason: "already_used" };

  const phone = normalizeEthiopianPhone(record.phoneNumber);
  // Stored phone numbers are already normalized E.164; fall back to the stored
  // value typed as an EthiopianPhone if re-normalization ever disagrees.
  const phoneForAudit: EthiopianPhone = phone ?? (record.phoneNumber as EthiopianPhone);

  // Verification rate limiting: bound attempts per phone and per request so we
  // never rely solely on the per-record 5-attempt counter.
  const verifyPhoneKey = buildScopedRateLimitKey("otp-verify", phoneForAudit);
  if (!checkRateLimit(verifyPhoneKey, VERIFY_PER_PHONE, currentTime).allowed) {
    return { ok: false, reason: "rate_limited" };
  }
  const verifyRequestKey = buildScopedRateLimitKey("otp-verify", requestId);
  if (!checkRateLimit(verifyRequestKey, VERIFY_PER_REQUEST, currentTime).allowed) {
    return { ok: false, reason: "rate_limited" };
  }
  const ip = options.ip?.trim();
  if (ip) {
    const verifyIpKey = buildScopedRateLimitKey("otp-verify", ip);
    if (!checkRateLimit(verifyIpKey, VERIFY_PER_REQUEST, currentTime).allowed) {
      return { ok: false, reason: "rate_limited" };
    }
  }

  const verdict = await evaluateOtp(
    record.otpHash,
    codeValue,
    currentTime,
    record.expiresAt.getTime(),
    record.attempts,
  );

  if (!verdict.ok) {
    if (verdict.reason === "max_attempts") {
      await writeAuditLog({
        action: OTP_AUDIT_ACTIONS.OTP_FAILED,
        actorUserId: record.userId,
        targetType: "phone_verification",
        targetId: requestId,
        metadata: { phone: phoneForAudit, reason: "max_attempts" },
      });
      return { ok: false, reason: "max_attempts" };
    }

    if (verdict.reason === "expired") {
      await writeAuditLog({
        action: OTP_AUDIT_ACTIONS.OTP_FAILED,
        actorUserId: record.userId,
        targetType: "phone_verification",
        targetId: requestId,
        metadata: { phone: phoneForAudit, reason: "expired" },
      });
      return { ok: false, reason: "expired" };
    }

    // Invalid code: increment attempts (only while unverified) and record a
    // failed attempt.
    await db
      .update(phoneVerifications)
      .set({ attempts: record.attempts + 1 })
      .where(
        and(
          eq(phoneVerifications.id, requestId),
          isNull(phoneVerifications.verifiedAt),
        ),
      )
      .catch(() => undefined);

    await writeAuditLog({
      action: OTP_AUDIT_ACTIONS.OTP_FAILED,
      actorUserId: record.userId,
      targetType: "phone_verification",
      targetId: requestId,
      metadata: { phone: phoneForAudit, reason: "invalid" },
    });
    return { ok: false, reason: "invalid" };
  }

  // Atomic consumption: only one concurrent request may flip verifiedAt from
  // null to a timestamp. If the conditional update matches zero rows, a
  // concurrent request already consumed this OTP.
  const consumed = await db
    .update(phoneVerifications)
    .set({ verifiedAt: new Date(currentTime) })
    .where(
      and(
        eq(phoneVerifications.id, requestId),
        isNull(phoneVerifications.verifiedAt),
      ),
    )
    .returning({ id: phoneVerifications.id })
    .catch(() => undefined);

  if (!consumed || consumed.length === 0) {
    await writeAuditLog({
      action: OTP_AUDIT_ACTIONS.OTP_FAILED,
      actorUserId: record.userId,
      targetType: "phone_verification",
      targetId: requestId,
      metadata: { phone: phoneForAudit, reason: "already_used" },
    });
    return { ok: false, reason: "already_used" };
  }

  await writeAuditLog({
    action: OTP_AUDIT_ACTIONS.OTP_VERIFIED,
    actorUserId: record.userId,
    targetType: "phone_verification",
    targetId: requestId,
    metadata: { phone: phoneForAudit },
  });

  return { ok: true, phone: phoneForAudit, userId: record.userId };
}

/**
 * Links a verified phone to a local user as a `phone` auth_account.
 *
 * The unique (provider, provider_account_id) constraint guarantees one verified
 * phone per platform, preventing account duplication. If the phone is already
 * linked to another account, the result is opaque (never auto-merged).
 *
 * This is the reusable primitive the future phone sign-in / account-linking
 * flows call, after creating (or resolving) the local JobEthiopia user and
 * creating the canonical session.
 */
export async function linkVerifiedPhone(
  userId: string,
  phone: string,
): Promise<LinkPhoneResult> {
  const normalized = normalizeEthiopianPhone(phone);
  if (!normalized) return { ok: false, reason: "invalid_phone" };

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });
  if (!user) return { ok: false, reason: "error" };

  try {
    const exists = await db.query.authAccounts.findFirst({
      where: and(
        eq(authAccounts.provider, "phone"),
        eq(authAccounts.providerAccountId, normalized),
      ),
      columns: { id: true, userId: true },
    });
    if (exists && exists.userId !== userId) {
      return { ok: false, reason: "duplicate" };
    }

    if (!exists) {
      await db.insert(authAccounts).values({
        userId,
        provider: "phone",
        providerAccountId: normalized,
      });
    }

    await writeAuditLog({
      action: OTP_AUDIT_ACTIONS.PHONE_LINKED,
      actorUserId: userId,
      targetType: "user",
      targetId: userId,
      metadata: { provider: "phone" },
    });

    return { ok: true, linked: !exists };
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
