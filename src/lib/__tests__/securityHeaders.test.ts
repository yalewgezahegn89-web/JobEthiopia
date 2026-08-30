import { describe, it, expect } from "vitest";
import { SECURITY_HEADERS } from "@/lib/securityHeaders";
import { buildCspHeader, generateCspNonce } from "@/lib/csp";

const EXPECTED_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
] as const;

describe("SECURITY_HEADERS", () => {
  it("defines exactly the three baseline headers with their exact values", () => {
    expect(SECURITY_HEADERS).toEqual(EXPECTED_HEADERS);
  });

  it("does not include deferred headers such as CSP or HSTS", () => {
    const keys = SECURITY_HEADERS.map((h) => h.key);
    expect(keys).not.toContain("Content-Security-Policy");
    expect(keys).not.toContain("Strict-Transport-Security");
    expect(keys).not.toContain("Permissions-Policy");
  });
});

describe("CSP header builder (Batch 72)", () => {
  const REQUIRED_DIRECTIVES = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'nonce-",
    "style-src 'self' 'nonce-",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "media-src 'none'",
  ] as const;

  it("contains every required directive", () => {
    const csp = buildCspHeader("TESTNONCE");
    for (const directive of REQUIRED_DIRECTIVES) {
      expect(csp).toContain(directive);
    }
  });

  it("places the supplied nonce exactly in script-src and style-src", () => {
    const csp = buildCspHeader("ABC123");
    expect(csp).toContain("script-src 'self' 'nonce-ABC123'");
    expect(csp).toContain("style-src 'self' 'nonce-ABC123'");
    expect(csp.match(/nonce-/g)).toHaveLength(2);
  });

  it("is deterministic for a supplied nonce", () => {
    expect(buildCspHeader("ABC123")).toBe(buildCspHeader("ABC123"));
  });

  it("never permits unsafe-inline", () => {
    expect(buildCspHeader("ABC123")).not.toContain("unsafe-inline");
  });

  it("never permits unsafe-eval", () => {
    expect(buildCspHeader("ABC123")).not.toContain("unsafe-eval");
  });

  it("never uses a wildcard source", () => {
    expect(buildCspHeader("ABC123")).not.toContain("*");
  });

  it("does not allow https: in script-src", () => {
    const scriptSrc = buildCspHeader("ABC123")
      .split(";")
      .find((directive) => directive.trim().startsWith("script-src"))!;
    expect(scriptSrc).not.toContain("https:");
  });

  it("never adds HSTS", () => {
    expect(buildCspHeader("ABC123")).not.toContain("Strict-Transport");
  });
});

describe("CSP nonce generation (Batch 72)", () => {
  it("produces unique base64 values of at least 128 bits", () => {
    const first = generateCspNonce();
    const second = generateCspNonce();
    expect(first).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(first.length).toBeGreaterThanOrEqual(22);
    expect(first).not.toBe(second);
  });
});
