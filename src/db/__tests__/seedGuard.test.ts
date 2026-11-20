import { describe, it, expect } from "vitest";
import {
  SEED_PRODUCTION_CONFIRMATION,
  assertSeedAllowed,
  evaluateSeedGuard,
  isProductionSeedEnvironment,
  normalizeHostname,
  parseDatabaseHostname,
} from "../seedGuard";

const PROD_HOST = "prod-db.example.internal";
const PREVIEW_HOST = "preview-db.example.internal";
const OTHER_HOST = "other-db.example.internal";

const prodDb = (host = PROD_HOST) => `postgresql://user:pass@${host}:5432/app`;
const previewDb = (host = PREVIEW_HOST) => `postgresql://user:pass@${host}:5432/app`;
const localDb = () => "postgresql://postgres:postgres@localhost:5432/app";

function baseNonProd(overrides: Record<string, string | undefined> = {}) {
  return {
    DATABASE_URL: previewDb(),
    SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
    SEED_ALLOWED_DATABASE_HOSTS: PREVIEW_HOST,
    ...overrides,
  };
}

describe("URL/hostname parsing and normalization", () => {
  it("extracts and normalizes hostname from a PostgreSQL URL", () => {
    expect(parseDatabaseHostname("postgres://u:p@Db.Example.COM./db")).toBe(
      "db.example.com",
    );
    expect(parseDatabaseHostname("postgresql://u:p@localhost:5432/db")).toBe(
      "localhost",
    );
    expect(parseDatabaseHostname("postgresql://u:p@[::1]:5432/db")).toBe(
      "::1",
    );
  });

  it("rejects missing, malformed, or non-PostgreSQL URLs", () => {
    expect(parseDatabaseHostname(undefined)).toBeNull();
    expect(parseDatabaseHostname("")).toBeNull();
    expect(parseDatabaseHostname("not-a-url")).toBeNull();
    expect(parseDatabaseHostname("mysql://u:p@localhost/db")).toBeNull();
    expect(parseDatabaseHostname("https://example.com/db")).toBeNull();
  });

  it("normalizes hostnames consistently (case, whitespace, trailing dot)", () => {
    expect(normalizeHostname(" Prod-DB.Example.Internal. ")).toBe(
      "prod-db.example.internal",
    );
    expect(normalizeHostname(" [::1] ")).toBe("::1");
    expect(normalizeHostname("")).toBeNull();
  });
});

describe("production environment policy", () => {
  it("1. denies production env with correct host but missing confirmation", () => {
    const result = evaluateSeedGuard({
      NODE_ENV: "production",
      DATABASE_URL: prodDb(),
      SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
    });
    expect(result).toEqual({
      allowed: false,
      environment: "production",
      reason: expect.stringContaining("CONFIRM_PRODUCTION_SEED"),
    });
  });

  it("2. allows production env with correct host and exact confirmation", () => {
    expect(
      evaluateSeedGuard({
        NODE_ENV: "production",
        DATABASE_URL: prodDb(),
        SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
        SEED_ALLOW_PRODUCTION: SEED_PRODUCTION_CONFIRMATION,
      }),
    ).toEqual({ allowed: true, environment: "production" });
  });

  it("3. denies production env with wrong host even with exact confirmation", () => {
    const result = evaluateSeedGuard({
      NODE_ENV: "production",
      DATABASE_URL: previewDb(),
      SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
      SEED_ALLOW_PRODUCTION: SEED_PRODUCTION_CONFIRMATION,
    });
    expect(result.allowed).toBe(false);
    expect(result.environment).toBe("production");
  });

  it("14. confirmation token alone never authorizes a host mismatch", () => {
    const result = evaluateSeedGuard({
      VERCEL_ENV: "production",
      DATABASE_URL: previewDb(OTHER_HOST),
      SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
      SEED_ALLOW_PRODUCTION: SEED_PRODUCTION_CONFIRMATION,
    });
    expect(result.allowed).toBe(false);
  });

  it("denies production env when production host identity is not configured", () => {
    const result = evaluateSeedGuard({
      NODE_ENV: "production",
      DATABASE_URL: prodDb(),
      SEED_ALLOW_PRODUCTION: SEED_PRODUCTION_CONFIRMATION,
    });
    expect(result.allowed).toBe(false);
  });
});

describe("preview and non-production policy", () => {
  it("4. denies preview env targeting production database host", () => {
    const result = evaluateSeedGuard({
      VERCEL_ENV: "preview",
      DATABASE_URL: prodDb(),
      SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
      SEED_ALLOWED_DATABASE_HOSTS: PREVIEW_HOST,
    });
    expect(result).toEqual({
      allowed: false,
      environment: "non-production",
      reason: expect.stringContaining("production database host"),
    });
  });

  it("5. denies VERCEL_ENV=preview + NODE_ENV=production targeting production host", () => {
    expect(
      isProductionSeedEnvironment({
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
      }),
    ).toBe(false);
    const result = evaluateSeedGuard({
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
      DATABASE_URL: prodDb(),
      SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
      SEED_ALLOWED_DATABASE_HOSTS: PREVIEW_HOST,
    });
    expect(result.allowed).toBe(false);
    expect(result.environment).toBe("non-production");
  });

  it("6. allows preview with allowlisted non-production remote host and configured production host", () => {
    expect(
      evaluateSeedGuard({
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
        ...baseNonProd(),
      }),
    ).toEqual({ allowed: true, environment: "preview" });
  });

  it("7. denies preview remote host not in allowlist", () => {
    const result = evaluateSeedGuard({
      VERCEL_ENV: "preview",
      ...baseNonProd({ DATABASE_URL: previewDb(OTHER_HOST) }),
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("SEED_ALLOWED_DATABASE_HOSTS");
    }
  });

  it("8. denies preview remote target when production host identity is missing", () => {
    const result = evaluateSeedGuard({
      VERCEL_ENV: "preview",
      DATABASE_URL: previewDb(),
      SEED_ALLOWED_DATABASE_HOSTS: PREVIEW_HOST,
      // SEED_PRODUCTION_DATABASE_HOST intentionally omitted
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("SEED_PRODUCTION_DATABASE_HOST");
    }
  });

  it("15. denies unknown deployment environment with a remote target (fails closed when ambiguous)", () => {
    // Unknown env is not preview/production; remote target must be fully and
    // explicitly configured. Missing allowlist fails closed.
    expect(
      evaluateSeedGuard({
        VERCEL_ENV: "staging",
        NODE_ENV: "staging",
        DATABASE_URL: previewDb(),
        SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
      }).allowed,
    ).toBe(false);
  });

  it("allows unknown env only when remote target is explicitly configured and safe", () => {
    expect(
      evaluateSeedGuard({
        VERCEL_ENV: "staging",
        NODE_ENV: "staging",
        ...baseNonProd(),
      }),
    ).toEqual({ allowed: true, environment: "development" });
  });
});

describe("local development policy", () => {
  it("9. allows local development with loopback PostgreSQL URL", () => {
    expect(evaluateSeedGuard({ DATABASE_URL: localDb() })).toEqual({
      allowed: true,
      environment: "development",
    });
    expect(
      evaluateSeedGuard({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/app",
      }).allowed,
    ).toBe(true);
    expect(
      evaluateSeedGuard({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://u:p@[::1]:5432/app",
      }).allowed,
    ).toBe(true);
  });

  it("10. denies local development with arbitrary remote host and no allowlist", () => {
    expect(
      evaluateSeedGuard({ DATABASE_URL: previewDb(OTHER_HOST) }).allowed,
    ).toBe(false);
  });

  it("11. allows local development with allowlisted remote non-production host", () => {
    expect(evaluateSeedGuard(baseNonProd())).toEqual({
      allowed: true,
      environment: "development",
    });
  });

  it("denies loopback in preview (preview must use allowlisted remote host)", () => {
    expect(
      evaluateSeedGuard({
        VERCEL_ENV: "preview",
        DATABASE_URL: localDb(),
      }).allowed,
    ).toBe(false);
  });
});

describe("missing or malformed DATABASE_URL", () => {
  it("12. denies missing or malformed DATABASE_URL", () => {
    for (const DATABASE_URL of [
      undefined,
      "",
      "   ",
      "not-a-url",
      "mysql://u:p@localhost/db",
    ]) {
      expect(evaluateSeedGuard({ DATABASE_URL }).allowed).toBe(false);
    }
  });
});

describe("confirmation handling", () => {
  it("13. accepts confirmation only from env, not command-line arguments", () => {
    const originalArgv = process.argv;
    try {
      process.argv = [
        ...originalArgv,
        `--confirm=${SEED_PRODUCTION_CONFIRMATION}`,
        SEED_PRODUCTION_CONFIRMATION,
      ];
      expect(
        evaluateSeedGuard({
          NODE_ENV: "production",
          DATABASE_URL: prodDb(),
          SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
        }).allowed,
      ).toBe(false);
    } finally {
      process.argv = originalArgv;
    }
  });

  it("requires the exact confirmation value", () => {
    const base = {
      NODE_ENV: "production",
      DATABASE_URL: prodDb(),
      SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
    };
    expect(
      evaluateSeedGuard({ ...base, SEED_ALLOW_PRODUCTION: "yes" }).allowed,
    ).toBe(false);
    expect(
      evaluateSeedGuard({
        ...base,
        SEED_ALLOW_PRODUCTION: SEED_PRODUCTION_CONFIRMATION,
      }).allowed,
    ).toBe(true);
  });
});

describe("exact matching and bypass resistance", () => {
  it("rejects prefix, suffix, and wildcard-style host bypass attempts", () => {
    // Target a non-allowlisted remote host while attempting to spoof the
    // allowlist via substring/wildcard-like values; must never be treated as a match.
    const attempts = [
      `evil-${PREVIEW_HOST}`,
      `${PREVIEW_HOST}.evil.example`,
      `not${PREVIEW_HOST}`,
      "*",
      `*${PREVIEW_HOST}*`,
      `${PREVIEW_HOST}?`,
    ];
    for (const host of attempts) {
      const result = evaluateSeedGuard({
        VERCEL_ENV: "preview",
        DATABASE_URL: `postgresql://u:p@${OTHER_HOST}:5432/app`,
        SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
        SEED_ALLOWED_DATABASE_HOSTS: host,
      });
      expect(result.allowed).toBe(false);
    }
  });

  it("matches allowlisted host exactly after normalization only", () => {
    expect(
      evaluateSeedGuard({
        VERCEL_ENV: "preview",
        DATABASE_URL: `postgresql://u:p@PREVIEW-DB.Example.Internal.:5432/app`,
        SEED_PRODUCTION_DATABASE_HOST: " PROD-DB.Example.Internal ",
        SEED_ALLOWED_DATABASE_HOSTS: " preview-db.example.internal. ",
      }),
    ).toEqual({ allowed: true, environment: "preview" });
  });

  it("treats a host that merely contains the production host as non-matching (denied unless allowlisted)", () => {
    const result = evaluateSeedGuard({
      VERCEL_ENV: "preview",
      DATABASE_URL: `postgresql://u:p@prefix-${PROD_HOST}:5432/app`,
      SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
      SEED_ALLOWED_DATABASE_HOSTS: PREVIEW_HOST,
    });
    expect(result.allowed).toBe(false);
  });
});

describe("assertSeedAllowed", () => {
  it("throws before seeding when unsafe", () => {
    expect(() =>
      assertSeedAllowed({
        NODE_ENV: "production",
        DATABASE_URL: prodDb(),
        SEED_PRODUCTION_DATABASE_HOST: PROD_HOST,
      }),
    ).toThrow(/Refusing to seed/);
  });

  it("does not throw for a safe local loopback target", () => {
    expect(() => assertSeedAllowed({ DATABASE_URL: localDb() })).not.toThrow();
  });
});
