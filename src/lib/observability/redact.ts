/**
 * Structured-log redaction (Batch 76).
 *
 * Shared, key-name based stripping used by the structured logger so that
 * passwords, tokens, API keys, cookies, authorization data, hashes, and raw
 * bodies never reach the log output. Mirrors the existing audit-log
 * sanitization philosophy but lives independently (it must not import the
 * audit module).
 */

export const REDACTED = "[REDACTED]";

/** Case-insensitive sensitive key segments. */
const SENSITIVE_SEGMENTS = [
  "password",
  "currentpassword",
  "newpassword",
  "token",
  "resettoken",
  "sessiontoken",
  "apikey",
  "authorization",
  "cookie",
  "databaseurl",
  "secret",
  "hash",
  "body",
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_SEGMENTS.some((seg) => lower.includes(seg));
}

/**
 * Returns a deep, redacted copy of `value`. Nested objects and arrays are
 * walked; any key whose name matches a sensitive segment has its value
 * replaced with `REDACTED`. Circular references are tolerated and rendered as
 * `REDACTED`.
 */
export function redactSensitive(
  value: unknown,
  key: string = "",
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "function" || typeof value === "symbol") return undefined;

  if (isSensitiveKey(key)) {
    return REDACTED;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, "", seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) return REDACTED;
    seen.add(value);

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactSensitive(v, k, seen);
    }
    seen.delete(value);
    return out;
  }

  return value;
}

/**
 * Produces a safe, single-line message string from a thrown value.
 *
 * Never includes a stack trace. For non-Error values a generic string is
 * returned. Callers that need a guaranteed-secret-safe event should prefer a
 * stable `errorCode` over a free-text `message`.
 */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message.replace(/\s+/g, " ").trim().slice(0, 200);
  }
  return "unknown error";
}
