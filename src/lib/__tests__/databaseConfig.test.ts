import { describe, it, expect, vi, afterEach } from "vitest";
import { getPoolConfig } from "@/db/index";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("database SSL in production (Phase 9 Batch 1)", () => {
  it("enables SSL when NODE_ENV is production and no overrides", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PG_DISABLE_SSL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@host:5432/db");

    const config = getPoolConfig();
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("does not force SSL when NODE_ENV is not production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PG_DISABLE_SSL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@host:5432/db");

    const config = getPoolConfig();
    expect(config.ssl).toBeUndefined();
  });

  it("respects PG_DISABLE_SSL=true in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PG_DISABLE_SSL", "true");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@host:5432/db");

    const config = getPoolConfig();
    expect(config.ssl).toBeUndefined();
  });

  it("defers to sslmode in URL when present", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PG_DISABLE_SSL", "");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:pass@host:5432/db?sslmode=require",
    );

    const config = getPoolConfig();
    // When sslmode is in URL, the Pool relies on the URL's sslmode
    expect(config.ssl).toBeUndefined();
  });
});
