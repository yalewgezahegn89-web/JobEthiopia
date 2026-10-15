import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockHeadersGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (key: string) => mocks.mockHeadersGet(key),
  }),
}));

import {
  assertTrustedCsrf,
  assertTrustedCsrfFromRequest,
  CsrfError,
  parseOrigin,
  getAppBaseUrl,
  getTrustedOrigin,
  getTrustedOrigins,
} from "@/lib/auth/csrf";

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseOrigin", () => {
  it("parses a canonical origin", () => {
    expect(parseOrigin("https://jobs.et/path")).toBe("https://jobs.et");
    expect(parseOrigin("https://jobs.et")).toBe("https://jobs.et");
  });

  it("normalizes the default port", () => {
    expect(parseOrigin("https://jobs.et:443/x")).toBe("https://jobs.et");
  });

  it("ignores query strings and fragments", () => {
    expect(parseOrigin("https://jobs.et?a=b")).toBe("https://jobs.et");
    expect(parseOrigin("https://jobs.et#frag")).toBe("https://jobs.et");
  });

  it("returns null for garbage or non-http inputs", () => {
    expect(parseOrigin("")).toBeNull();
    expect(parseOrigin("not a url")).toBeNull();
    expect(parseOrigin("ftp://jobs.et")).toBeNull();
    expect(parseOrigin("javascript:alert(1)")).toBeNull();
  });
});

describe("getTrustedOrigin", () => {
  it("uses APP_BASE_URL when set", () => {
    vi.stubEnv("APP_BASE_URL", "https://admin.jobs.et");
    expect(getTrustedOrigin()).toBe("https://admin.jobs.et");
  });

  it("falls back to localhost for local development", () => {
    vi.stubEnv("APP_BASE_URL", "");
    expect(getTrustedOrigin()).toBe("http://localhost:3000");
  });
});

describe("Vercel Preview trusted origins", () => {
  it("adds the exact current Preview deployment origin when VERCEL_ENV=preview", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv(
      "VERCEL_URL",
      "jobethiopia-staging-c4diapfup-instagrambirr-9264.vercel.app",
    );
    expect(getTrustedOrigins()).toEqual(
      new Set([
        "https://jobs.et",
        "https://jobethiopia-staging-c4diapfup-instagrambirr-9264.vercel.app",
      ]),
    );
  });

  it("accepts the exact current Preview deployment origin in preview", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "jobethiopia-staging-abc123.vercel.app");
    expect(() =>
      assertTrustedCsrf({
        origin: "https://jobethiopia-staging-abc123.vercel.app",
      }),
    ).not.toThrow();
  });

  it("still accepts the exact canonical production origin in preview", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "jobethiopia-staging-abc123.vercel.app");
    expect(() => assertTrustedCsrf({ origin: "https://jobs.et" })).not.toThrow();
  });

  it("rejects an arbitrary, unrelated Vercel deployment origin in preview", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "jobethiopia-staging-abc123.vercel.app");
    expect(() =>
      assertTrustedCsrf({
        origin: "https://some-other-project-xyz123.vercel.app",
      }),
    ).toThrow(CsrfError);
  });

  it("rejects a lookalike Vercel origin that only contains the trusted deployment host", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "jobethiopia-staging-abc123.vercel.app");
    expect(() =>
      assertTrustedCsrf({
        origin: "https://jobethiopia-staging-abc123.vercel.app.evil.example",
      }),
    ).toThrow(CsrfError);
    expect(() =>
      assertTrustedCsrf({
        origin: "https://evil-jobethiopia-staging-abc123.vercel.app",
      }),
    ).toThrow(CsrfError);
  });

  it("rejects a different scheme for the trusted Preview deployment origin", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "jobethiopia-staging-abc123.vercel.app");
    expect(() =>
      assertTrustedCsrf({
        origin: "http://jobethiopia-staging-abc123.vercel.app",
      }),
    ).toThrow(CsrfError);
  });

  it("does not trust the deployment origin outside of preview", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "jobethiopia-staging-abc123.vercel.app");
    expect(getTrustedOrigins()).toEqual(new Set(["https://jobs.et"]));
    expect(() =>
      assertTrustedCsrf({
        origin: "https://jobethiopia-staging-abc123.vercel.app",
      }),
    ).toThrow(CsrfError);
  });

  it("ignores a missing or unparsable VERCEL_URL in preview", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "");
    expect(getTrustedOrigins()).toEqual(new Set(["https://jobs.et"]));

    vi.stubEnv("VERCEL_URL", "https://already-has-scheme.vercel.app");
    expect(getTrustedOrigins()).toEqual(new Set(["https://jobs.et"]));
  });
});

describe("getAppBaseUrl production safety (B98)", () => {
  it("throws in production when APP_BASE_URL is missing or blank", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASE_URL", "");
    expect(() => getAppBaseUrl()).toThrow("APP_BASE_URL is required in production");
    vi.stubEnv("APP_BASE_URL", "   ");
    expect(() => getAppBaseUrl()).toThrow("APP_BASE_URL is required in production");
  });

  it("returns the configured value in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASE_URL", "https://jobs.example.com");
    expect(getAppBaseUrl()).toBe("https://jobs.example.com");
  });
});

describe("assertTrustedCsrf", () => {
  it("accepts an exact trusted origin", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    expect(() => assertTrustedCsrf({ origin: "https://jobs.et" })).not.toThrow();
  });

  it("accepts trusted origin with a path", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    expect(() =>
      assertTrustedCsrf({ origin: "https://jobs.et/admin/jobs" }),
    ).not.toThrow();
  });

  it("uses referer as a fallback when origin is absent", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    expect(() =>
      assertTrustedCsrf({ origin: null, referer: "https://jobs.et/admin/jobs" }),
    ).not.toThrow();
  });

  it("rejects a cross-origin attacker", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    expect(() => assertTrustedCsrf({ origin: "https://evil.example" })).toThrow(CsrfError);
  });

  it("rejects a lookalike that only contains the base host", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    expect(() =>
      assertTrustedCsrf({ origin: "https://jobs.et.evil.example" }),
    ).toThrow(CsrfError);
    expect(() =>
      assertTrustedCsrf({ origin: "https://evil-jobs.et" }),
    ).toThrow(CsrfError);
  });

  it("rejects a same-host but different scheme", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    expect(() => assertTrustedCsrf({ origin: "http://jobs.et" })).toThrow(CsrfError);
  });

  it("rejects a qualified subdomain of the base host", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    expect(() => assertTrustedCsrf({ origin: "https://sub.jobs.et" })).toThrow(CsrfError);
  });

  it("rejects missing origin and referer", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    expect(() => assertTrustedCsrf({ origin: null, referer: null })).toThrow(CsrfError);
    expect(() => assertTrustedCsrf({})).toThrow(CsrfError);
  });

  it("rejects an untrusted referer when origin is authoritative", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    expect(() =>
      assertTrustedCsrf({ origin: "https://jobs.et", referer: "https://evil.example/x" }),
    ).not.toThrow();
  });
});

describe("assertTrustedCsrfFromRequest", () => {
  it("reads origin from headers and validates", async () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    mocks.mockHeadersGet.mockImplementation((key: string) =>
      key === "origin" ? "https://jobs.et" : null,
    );
    await expect(assertTrustedCsrfFromRequest()).resolves.toBe(true);
  });

  it("rejects a cross-origin header value", async () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    mocks.mockHeadersGet.mockImplementation((key: string) =>
      key === "origin" ? "https://evil.example" : null,
    );
    await expect(assertTrustedCsrfFromRequest()).rejects.toThrow(CsrfError);
  });

  it("rejects when headers carry neither origin nor referer", async () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.et");
    mocks.mockHeadersGet.mockReturnValue(null);
    await expect(assertTrustedCsrfFromRequest()).rejects.toThrow(CsrfError);
  });
});
