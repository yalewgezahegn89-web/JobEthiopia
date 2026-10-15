/**
 * OTP (one-time password) generation & verification abstraction (Stage 1).
 *
 * This module is deliberately provider-agnostic. It owns the pure OTP domain
 * concerns: secure code generation, secure hashing, expiry and attempt policy.
 * It does NOT talk to the database or to any SMS provider. The SMS transport
 * (Ethio telecom / Safaricom Ethiopia / other) will plug into the
 * phone-verification service layer without touching this module.
 *
 * Security properties:
 *   - Codes come from node:crypto's cryptographically secure random source
 *     (never Math.random()).
 *   - Only a salted scrypt hash of the code is ever stored/hashed; the raw
 *     code is never persisted and never logged.
 *   - Codes expire quickly and are bounded by a maximum attempt count.
 */

import { randomInt, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60s between sends

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;

function scryptAsync(
  value: string,
  salt: Buffer,
  keyLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      value,
      salt,
      keyLength,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      },
    );
  });
}

/**
 * Generates a new OTP code as a zero-padded numeric string of OTP_LENGTH
 * digits, drawn from a cryptographically secure random source.
 */
export function generateOtpCode(): string {
  const value = randomInt(0, 10 ** OTP_LENGTH);
  return value.toString().padStart(OTP_LENGTH, "0");
}

/**
 * Returns a salt-and-time scrypt hash of an OTP code. Only this hash is ever
 * persisted; the raw code is never stored.
 *
 * The scrypt salt is unique per issuance, so identical codes hash differently.
 */
export function hashOtp(code: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  return scryptAsync(code, salt, SCRYPT_KEY_LENGTH).then((key) =>
    [
      "scrypt",
      SCRYPT_N,
      SCRYPT_R,
      SCRYPT_P,
      salt.toString("hex"),
      key.toString("hex"),
    ].join("$"),
  );
}

/**
 * Verifies a raw code against a stored hash. Returns false on any malformed
 * hash or mismatch (never throws), so callers cannot distinguish failures.
 */
export async function verifyOtpCode(
  storedHash: string,
  code: string,
): Promise<boolean> {
  if (
    typeof storedHash !== "string" ||
    typeof code !== "string" ||
    code.length !== OTP_LENGTH ||
    !/^\d+$/.test(code)
  ) {
    return false;
  }

  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await scryptAsync(code, salt, expected.length);
  } catch {
    return false;
  }

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Evaluates whether an OTP is valid given a stored hash, expiry timestamp and
 * the number of attempts already used. Used by the phone-verification service
 * to enforce quick expiry + bounded attempts in one place.
 */
export async function evaluateOtp(
  storedHash: string,
  code: string,
  now: number,
  expiresAtMs: number,
  attemptsUsed: number,
): Promise<{ ok: true } | { ok: false; reason: "expired" | "max_attempts" | "invalid" }> {
  if (now > expiresAtMs) return { ok: false, reason: "expired" };
  if (attemptsUsed >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "max_attempts" };
  const matches = await verifyOtpCode(storedHash, code);
  if (!matches) return { ok: false, reason: "invalid" };
  return { ok: true };
}
