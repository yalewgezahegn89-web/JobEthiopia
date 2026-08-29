import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing using Node's built-in scrypt.
 *
 * Chosen over bcrypt/argon2 because:
 * - scrypt ships in node:crypto (no native build, no dependency, no supply chain)
 * - it is a memory-hard KDF with a tunable cost (N/r/p)
 * - verification is free of a separate library API surface
 *
 * Format (self-describing, 6 parts):
 *   scrypt$N$r$p$saltHex$derivedKeyHex
 * The parameters are stored in the hash so future cost increases remain
 * backwards-verifiable.
 */

const DEFAULT_N = 16384;
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

interface ScryptOptions {
  N: number;
  r: number;
  p: number;
  keylen: number;
}

/** Minimum length enforced at creation time only (login never enforces policy). */
export const MIN_PASSWORD_LENGTH = 8;

function scryptAsync(
  password: string,
  salt: Buffer,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, options.keylen, options, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error("Password must be at least 8 characters");
  }

  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, {
    N: DEFAULT_N,
    r: DEFAULT_R,
    p: DEFAULT_P,
    keylen: KEY_LENGTH,
  });

  return [
    "scrypt",
    DEFAULT_N,
    DEFAULT_R,
    DEFAULT_P,
    salt.toString("hex"),
    key.toString("hex"),
  ].join("$");
}

export function isValidPasswordInput(password: string): boolean {
  return typeof password === "string" && password.length > 0;
}

/**
 * Verifies a password against a stored hash. Returns false for any
 * malformed hash rather than throwing, so callers never leak hash details.
 */
export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  if (typeof passwordHash !== "string" || typeof password !== "string") {
    return false;
  }

  const parts = passwordHash.split("$");
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
    actual = await scryptAsync(password, salt, { N: n, r, p, keylen: expected.length });
  } catch {
    return false;
  }

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}