import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validateProductionConfig,
  formatProductionConfigResult,
} from "@/lib/productionConfig";

describe("validateProductionConfig", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.DATABASE_URL;
    delete process.env.INGESTION_API_KEY;
    delete process.env.MAINTENANCE_API_KEY;
    delete process.env.INGESTION_ORGANIZATION_ID;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns ok in non-production regardless of env vars", () => {
    vi.stubEnv("NODE_ENV", "development");
    const result = validateProductionConfig();
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("returns ok in test environment", () => {
    vi.stubEnv("NODE_ENV", "test");
    const result = validateProductionConfig();
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("returns missing vars in production when none are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    const result = validateProductionConfig();
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(4);
    const names = result.missing.map((m) => m.variable);
    expect(names).toContain("DATABASE_URL");
    expect(names).toContain("INGESTION_API_KEY");
    expect(names).toContain("MAINTENANCE_API_KEY");
    expect(names).toContain("INGESTION_ORGANIZATION_ID");
  });

  it("returns ok in production when all required vars are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.DATABASE_URL = "postgresql://localhost/test";
    process.env.INGESTION_API_KEY = "test-key";
    process.env.MAINTENANCE_API_KEY = "test-key";
    process.env.INGESTION_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000000";
    const result = validateProductionConfig();
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("treats blank/whitespace values as missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.DATABASE_URL = "   ";
    process.env.INGESTION_API_KEY = "";
    const result = validateProductionConfig();
    expect(result.ok).toBe(false);
    const names = result.missing.map((m) => m.variable);
    expect(names).toContain("DATABASE_URL");
    expect(names).toContain("INGESTION_API_KEY");
  });

  it("reports purpose for each missing variable", () => {
    vi.stubEnv("NODE_ENV", "production");
    const result = validateProductionConfig();
    for (const item of result.missing) {
      expect(typeof item.purpose).toBe("string");
      expect(item.purpose.length).toBeGreaterThan(0);
    }
  });
});

describe("formatProductionConfigResult", () => {
  it("returns ok string when result is ok", () => {
    expect(formatProductionConfigResult({ ok: true, missing: [] })).toBe(
      "production_config_ok",
    );
  });

  it("returns missing variable names when not ok", () => {
    const result = {
      ok: false,
      missing: [
        { variable: "DATABASE_URL", purpose: "PostgreSQL connection string" },
        { variable: "MAINTENANCE_API_KEY", purpose: "Internal API key" },
      ],
    };
    const formatted = formatProductionConfigResult(result);
    expect(formatted).toBe(
      "production_config_missing: DATABASE_URL, MAINTENANCE_API_KEY",
    );
  });

  it("never includes variable values in the output", () => {
    const result = {
      ok: false,
      missing: [{ variable: "DATABASE_URL", purpose: "DB connection" }],
    };
    const formatted = formatProductionConfigResult(result);
    expect(formatted).not.toContain("postgresql://");
    expect(formatted).not.toContain("password");
  });
});
