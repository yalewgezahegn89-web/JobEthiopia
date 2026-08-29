import { describe, it, expect } from "vitest";
import { SECURITY_HEADERS } from "@/lib/securityHeaders";

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
