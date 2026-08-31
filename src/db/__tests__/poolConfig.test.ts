import { describe, it, expect, afterEach, vi } from "vitest";
import { getPoolConfig } from "@/db";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPoolConfig (B98)", () => {
  it("uses conservative finite defaults with no SSL in non-production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/jobethiopia");
    const cfg = getPoolConfig();
    expect(cfg.connectionString).toBe(
      "postgresql://user:pass@localhost:5432/jobethiopia",
    );
    expect(cfg.connectionTimeoutMillis).toBe(10000);
    expect(cfg.max).toBe(10);
    expect(cfg.idleTimeoutMillis).toBe(30000);
    expect(cfg.ssl).toBeUndefined();
  });

  it("enables SSL in production with default CA verification", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.example.com:5432/jobethiopia");
    const cfg = getPoolConfig();
    expect(cfg.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("does not force SSL when the URL already declares sslmode", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:pass@db.example.com:5432/jobethiopia?sslmode=require",
    );
    const cfg = getPoolConfig();
    expect(cfg.ssl).toBeUndefined();
  });

  it("honors PG_DISABLE_SSL in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.example.com:5432/jobethiopia");
    vi.stubEnv("PG_DISABLE_SSL", "true");
    const cfg = getPoolConfig();
    expect(cfg.ssl).toBeUndefined();
  });

  it("respects explicit pool tuning env vars and falls back on invalid input", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PG_CONNECTION_TIMEOUT_MS", "5000");
    vi.stubEnv("PG_POOL_MAX", "5");
    vi.stubEnv("PG_IDLE_TIMEOUT_MS", "15000");
    let cfg = getPoolConfig();
    expect(cfg.connectionTimeoutMillis).toBe(5000);
    expect(cfg.max).toBe(5);
    expect(cfg.idleTimeoutMillis).toBe(15000);

    vi.stubEnv("PG_POOL_MAX", "not-a-number");
    cfg = getPoolConfig();
    expect(cfg.max).toBe(10);
  });
});
