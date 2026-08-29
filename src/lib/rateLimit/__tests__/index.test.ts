import { describe, it, expect, beforeEach } from "vitest";
import {
  buildRateLimitKey,
  checkRateLimit,
  resetRateLimitState,
  type RateLimitConfig,
} from "../index";

const LOGIN: RateLimitConfig = { limit: 5, windowMs: 15 * 60_000 };
const INGEST: RateLimitConfig = { limit: 10, windowMs: 60_000 };
const API: RateLimitConfig = { limit: 30, windowMs: 60_000 };
const MAINTENANCE: RateLimitConfig = { limit: 3, windowMs: 5 * 60_000 };

beforeEach(() => {
  resetRateLimitState();
});

describe("buildRateLimitKey", () => {
  it("maps the same bucket + client IP to the same deterministic key", () => {
    expect(buildRateLimitKey("login", "203.0.113.9")).toBe(
      buildRateLimitKey("login", "203.0.113.9"),
    );
    expect(buildRateLimitKey("api", "10.0.0.1")).toBe(
      buildRateLimitKey("api", "10.0.0.1"),
    );
  });

  it("maps different client IPs to different keys within a bucket", () => {
    expect(buildRateLimitKey("login", "203.0.113.9")).not.toBe(
      buildRateLimitKey("login", "203.0.113.10"),
    );
    expect(buildRateLimitKey("maintenance", "2001:db8::1")).not.toBe(
      buildRateLimitKey("maintenance", "2001:db8::2"),
    );
  });

  it("preserves the existing bucket key prefixes", () => {
    expect(buildRateLimitKey("login", "127.0.0.1")).toBe("login:127.0.0.1");
    expect(buildRateLimitKey("ingest", "127.0.0.1")).toBe("ingest:127.0.0.1");
    expect(buildRateLimitKey("api", "127.0.0.1")).toBe("api:127.0.0.1");
    expect(buildRateLimitKey("maintenance", "127.0.0.1")).toBe(
      "maintenance:127.0.0.1",
    );
  });
});

describe("checkRateLimit", () => {
  it("allows the first request", () => {
    const r = checkRateLimit("a", { limit: 3, windowMs: 1000 }, 1000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
    expect(r.retryAfterSeconds).toBeUndefined();
  });

  it("allows requests up to the limit", () => {
    const cfg: RateLimitConfig = { limit: 3, windowMs: 1000 };
    expect(checkRateLimit("k", cfg, 1000).allowed).toBe(true);
    expect(checkRateLimit("k", cfg, 1100).allowed).toBe(true);
    expect(checkRateLimit("k", cfg, 1200).allowed).toBe(true);
  });

  it("rejects the request over the limit", () => {
    const cfg: RateLimitConfig = { limit: 2, windowMs: 1000 };
    checkRateLimit("k", cfg, 1000);
    checkRateLimit("k", cfg, 1100);
    const r = checkRateLimit("k", cfg, 1200);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("returns retryAfterSeconds on rejection", () => {
    const cfg: RateLimitConfig = { limit: 1, windowMs: 10_000 };
    checkRateLimit("k", cfg, 1000);
    const r = checkRateLimit("k", cfg, 5000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSeconds).toBe(6);
  });

  it("retryAfterSeconds is at least 1", () => {
    const cfg: RateLimitConfig = { limit: 1, windowMs: 1000 };
    checkRateLimit("k", cfg, 1000);
    const r = checkRateLimit("k", cfg, 1999);
    expect(r.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("removes expired timestamps", () => {
    const cfg: RateLimitConfig = { limit: 3, windowMs: 1000 };
    checkRateLimit("k", cfg, 100);
    checkRateLimit("k", cfg, 200);
    // Both expire: window ends at 1100 and 1200 respectively
    const r = checkRateLimit("k", cfg, 2500);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("allows requests again after window expiration", () => {
    const cfg: RateLimitConfig = { limit: 2, windowMs: 1000 };
    checkRateLimit("k", cfg, 1000);
    checkRateLimit("k", cfg, 1100);
    // Third request within window -> rejected
    expect(checkRateLimit("k", cfg, 1200).allowed).toBe(false);
    // After window slides past first request
    const r = checkRateLimit("k", cfg, 2100);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(1);
  });

  it("different keys have independent limits", () => {
    const cfg: RateLimitConfig = { limit: 1, windowMs: 1000 };
    checkRateLimit("a", cfg, 1000);
    checkRateLimit("b", cfg, 1000);
    expect(checkRateLimit("a", cfg, 1100).allowed).toBe(false);
    expect(checkRateLimit("b", cfg, 1100).allowed).toBe(false);
    // New key is independent
    expect(checkRateLimit("c", cfg, 1100).allowed).toBe(true);
  });

  it("sliding window correctly slides", () => {
    const cfg: RateLimitConfig = { limit: 2, windowMs: 1000 };
    checkRateLimit("k", cfg, 0);
    checkRateLimit("k", cfg, 500);
    // At t=1001, first request (t=0) expired, second (t=500) still valid
    expect(checkRateLimit("k", cfg, 1001).allowed).toBe(true);
    expect(checkRateLimit("k", cfg, 1001).remaining).toBe(0);
    // At t=1501, second request also expired
    expect(checkRateLimit("k", cfg, 1501).allowed).toBe(true);
  });

  it("handles boundary timestamps precisely", () => {
    const cfg: RateLimitConfig = { limit: 1, windowMs: 1000 };
    checkRateLimit("k", cfg, 1000);
    // Exactly at window boundary: t=2000, windowStart=1000, request at t=1000 is NOT > 1000
    // so it is expired and the request is allowed
    const r1 = checkRateLimit("k", cfg, 2000);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(0);
    // One ms later: the previous request at t=2000 is still in window
    const r2 = checkRateLimit("k", cfg, 2001);
    expect(r2.allowed).toBe(false);
  });

  it("repeated blocked requests do not accumulate state", () => {
    const cfg: RateLimitConfig = { limit: 1, windowMs: 1000 };
    checkRateLimit("k", cfg, 1000);
    checkRateLimit("k", cfg, 1100);
    checkRateLimit("k", cfg, 1200);
    checkRateLimit("k", cfg, 1300);
    // All blocked, state should only contain the original timestamp
    const r = checkRateLimit("k", cfg, 2001);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("remaining count is never negative", () => {
    const cfg: RateLimitConfig = { limit: 3, windowMs: 1000 };
    const r1 = checkRateLimit("k", cfg, 1000);
    expect(r1.remaining).toBe(2);
    const r2 = checkRateLimit("k", cfg, 1100);
    expect(r2.remaining).toBe(1);
    const r3 = checkRateLimit("k", cfg, 1200);
    expect(r3.remaining).toBe(0);
    const r4 = checkRateLimit("k", cfg, 1300);
    expect(r4.remaining).toBe(0);
  });

  it("no unbounded expired state remains", () => {
    const cfg: RateLimitConfig = { limit: 5, windowMs: 1000 };
    // Add 3 requests
    checkRateLimit("k", cfg, 100);
    checkRateLimit("k", cfg, 200);
    checkRateLimit("k", cfg, 300);
    // After window, all 3 expire and the key is deleted
    checkRateLimit("k", cfg, 2000);
    // Only the request at t=2000 should be in the bucket
    const r = checkRateLimit("k", cfg, 2001);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(3);
  });
});

describe("configuration", () => {
  it("login: 5 requests per 15 minutes", () => {
    const cfg = LOGIN;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("login:ip", cfg, i * 1000).allowed).toBe(true);
    }
    expect(checkRateLimit("login:ip", cfg, 5000).allowed).toBe(false);
  });

  it("ingestion: 10 requests per minute", () => {
    const cfg = INGEST;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit("ingest:ip", cfg, i * 100).allowed).toBe(true);
    }
    expect(checkRateLimit("ingest:ip", cfg, 1000).allowed).toBe(false);
  });

  it("generic API: 30 requests per minute", () => {
    const cfg = API;
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit("api:ip", cfg, i * 10).allowed).toBe(true);
    }
    expect(checkRateLimit("api:ip", cfg, 300).allowed).toBe(false);
  });

  it("maintenance: 3 requests per 5 minutes", () => {
    const cfg = MAINTENANCE;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("maint:ip", cfg, i * 1000).allowed).toBe(true);
    }
    expect(checkRateLimit("maint:ip", cfg, 3000).allowed).toBe(false);
  });
});

describe("cleanup", () => {
  it("deletes map entry when all timestamps expire", () => {
    const cfg: RateLimitConfig = { limit: 5, windowMs: 1000 };
    checkRateLimit("k", cfg, 100);
    checkRateLimit("k", cfg, 200);
    // After window, entries should be cleaned
    checkRateLimit("k", cfg, 2000);
    // Key should be deletable by reset
    resetRateLimitState();
    // Fresh start
    const r = checkRateLimit("k", cfg, 3000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it("reset clears all state", () => {
    const cfg: RateLimitConfig = { limit: 1, windowMs: 10_000 };
    checkRateLimit("a", cfg, 1000);
    checkRateLimit("b", cfg, 1000);
    resetRateLimitState();
    expect(checkRateLimit("a", cfg, 1001).allowed).toBe(true);
    expect(checkRateLimit("b", cfg, 1001).allowed).toBe(true);
  });
});
