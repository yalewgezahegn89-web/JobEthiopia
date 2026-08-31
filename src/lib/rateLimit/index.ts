/**
 * Process-local sliding-window rate limiter (Batch 55).
 *
 * This is in-memory and process-local. It does NOT provide distributed or
 * cross-instance rate limiting. Each server process maintains its own state.
 */

export type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
};

/**
 * Rate-limit bucket families. The string prefixes produced by
 * `buildRateLimitKey` are part of the limiting contract and must not change.
 */
export type RateLimitBucket =
  | "login"
  | "ingest"
  | "api"
  | "maintenance"
  | "applications"
  | "resume"
  | "bulk"
  | "register";

/**
 * Builds the deterministic in-memory bucket key for a bucket + client identity.
 *
 * This is the single canonical key builder: middleware must not construct
 * keys inline. The client identity is resolved by the middleware (Batch 63);
 * this helper only derives the storage key so that the same identity and
 * bucket always map to the same key and different identities map to
 * different keys.
 */
export function buildRateLimitKey(
  bucket: RateLimitBucket,
  clientIp: string,
): string {
  return `${bucket}:${clientIp}`;
}

const buckets = new Map<string, number[]>();

/**
 * Sliding-window rate limiter.
 *
 * @param key   Unique identifier for the rate-limit bucket (e.g. "login:127.0.0.1").
 * @param config  Maximum requests allowed within the sliding window.
 * @param now   Current time in milliseconds (inject for deterministic tests).
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now?: number,
): RateLimitResult {
  const currentTime = now ?? Date.now();
  const windowStart = currentTime - config.windowMs;

  let timestamps = buckets.get(key);

  if (timestamps) {
    // Remove expired timestamps (those older than the window).
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length === 0) {
      buckets.delete(key);
      timestamps = undefined;
    } else {
      buckets.set(key, timestamps);
    }
  }

  if (timestamps && timestamps.length >= config.limit) {
    const oldest = timestamps[0]!;
    const retryAfterMs = oldest + config.windowMs - currentTime;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  const next = timestamps ? [...timestamps, currentTime] : [currentTime];
  buckets.set(key, next);

  return { allowed: true, remaining: config.limit - next.length };
}

/**
 * Resets all rate-limit state. Intended for isolated test teardown only.
 * Not exported from the package barrel — import directly in test files.
 */
export function resetRateLimitState(): void {
  buckets.clear();
}
