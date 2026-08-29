import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { resetRateLimitState } from "@/lib/rateLimit";

const mocks = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockNext: vi.fn(),
  mockJson: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: mocks.mockRedirect,
    next: mocks.mockNext,
    json: mocks.mockJson,
  },
}));

const mockRedirect = mocks.mockRedirect;
const mockNext = mocks.mockNext;
const mockJson = mocks.mockJson;

import { middleware, config } from "@/middleware";

function fakeRequest(
  overrides: {
    cookieValue?: string;
    pathname?: string;
    method?: string;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const {
    cookieValue,
    pathname = "/admin",
    method = "GET",
    headers = {},
  } = overrides;
  return {
    cookies: {
      get: () => (cookieValue ? { value: cookieValue } : undefined),
    },
    nextUrl: {
      pathname,
      clone: () => ({ pathname }),
    },
    method,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitState();
});

afterEach(() => {
  delete process.env.TRUSTED_CLIENT_IP_HEADER;
});

describe("middleware — matcher", () => {
  it("matches admin, api, and login routes", () => {
    expect(config.matcher).toEqual([
      "/admin/:path*",
      "/api/:path*",
      "/login",
    ]);
  });
});

describe("middleware — admin cookie check", () => {
  it("redirects to /login when no session cookie is present", () => {
    mockRedirect.mockReturnValue({ redirected: true });

    middleware(fakeRequest({ cookieValue: undefined, pathname: "/admin" }));
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect.mock.calls[0][0].pathname).toBe("/login");
  });

  it("does not redirect when the cookie is empty", () => {
    middleware(fakeRequest({ cookieValue: "", pathname: "/admin" }));
    expect(mockRedirect).toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("allows the request through when a session cookie exists", () => {
    mockNext.mockReturnValue({ passed: true });
    const result = middleware(
      fakeRequest({ cookieValue: "some-raw-token", pathname: "/admin" }),
    );
    expect(result).toEqual({ passed: true });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("middleware — rate limiting", () => {
  describe("login POST", () => {
    it("allows login POST within limit", () => {
      mockNext.mockReturnValue({ passed: true });
      const result = middleware(
        fakeRequest({
          pathname: "/login",
          method: "POST",
          headers: { "x-forwarded-for": "1.2.3.4" },
        }),
      );
      expect(result).toEqual({ passed: true });
      expect(mockJson).not.toHaveBeenCalled();
    });

    it("blocks login POST after 5 attempts", () => {
      mockJson.mockReturnValue({ status: 429 });
      for (let i = 0; i < 5; i++) {
        middleware(
          fakeRequest({
            pathname: "/login",
            method: "POST",
            headers: { "x-forwarded-for": "1.2.3.4" },
          }),
        );
      }
      middleware(
        fakeRequest({
          pathname: "/login",
          method: "POST",
          headers: { "x-forwarded-for": "1.2.3.4" },
        }),
      );
      expect(mockJson).toHaveBeenCalled();
      const [body, init] = mockJson.mock.calls[mockJson.mock.calls.length - 1];
      expect(body.error).toMatch(/too many/i);
      expect(init.status).toBe(429);
      expect(Number(init.headers["Retry-After"])).toBeGreaterThan(0);
    });

    it("does not rate-limit login GET", () => {
      mockNext.mockReturnValue({ passed: true });
      for (let i = 0; i < 10; i++) {
        middleware(
          fakeRequest({
            pathname: "/login",
            method: "GET",
          }),
        );
      }
      expect(mockJson).not.toHaveBeenCalled();
    });
  });

  describe("API mutations", () => {
    it("allows POST within limit", () => {
      mockNext.mockReturnValue({ passed: true });
      const result = middleware(
        fakeRequest({
          pathname: "/api/jobs",
          method: "POST",
          headers: { "x-forwarded-for": "5.6.7.8" },
        }),
      );
      expect(result).toEqual({ passed: true });
      expect(mockJson).not.toHaveBeenCalled();
    });

    it("blocks POST after 30 attempts", () => {
      mockJson.mockReturnValue({ status: 429 });
      for (let i = 0; i < 30; i++) {
        middleware(
          fakeRequest({
            pathname: "/api/jobs",
            method: "POST",
            headers: { "x-forwarded-for": "5.6.7.8" },
          }),
        );
      }
      middleware(
        fakeRequest({
          pathname: "/api/jobs",
          method: "POST",
          headers: { "x-forwarded-for": "5.6.7.8" },
        }),
      );
      expect(mockJson).toHaveBeenCalled();
    });

    it("does not rate-limit GET requests", () => {
      mockNext.mockReturnValue({ passed: true });
      for (let i = 0; i < 50; i++) {
        middleware(
          fakeRequest({
            pathname: "/api/jobs",
            method: "GET",
            headers: { "x-forwarded-for": "5.6.7.8" },
          }),
        );
      }
      expect(mockJson).not.toHaveBeenCalled();
    });

    it("separately tracks PUT, PATCH, DELETE", () => {
      mockNext.mockReturnValue({ passed: true });
      // Use up the limit with PUT
      for (let i = 0; i < 30; i++) {
        middleware(
          fakeRequest({
            pathname: "/api/jobs/abc",
            method: "PUT",
            headers: { "x-forwarded-for": "9.9.9.9" },
          }),
        );
      }
      // DELETE shares the same api: key, so it should also be blocked
      mockJson.mockReturnValue({ status: 429 });
      middleware(
        fakeRequest({
          pathname: "/api/jobs/abc",
          method: "DELETE",
          headers: { "x-forwarded-for": "9.9.9.9" },
        }),
      );
      expect(mockJson).toHaveBeenCalled();
    });
  });

  describe("job ingestion", () => {
    it("allows POST /api/jobs/ingest within limit", () => {
      mockNext.mockReturnValue({ passed: true });
      for (let i = 0; i < 10; i++) {
        const result = middleware(
          fakeRequest({
            pathname: "/api/jobs/ingest",
            method: "POST",
            headers: { "x-forwarded-for": "10.0.0.1" },
          }),
        );
        expect(result).toEqual({ passed: true });
      }
      expect(mockJson).not.toHaveBeenCalled();
    });

    it("blocks POST /api/jobs/ingest after 10 attempts", () => {
      mockJson.mockReturnValue({ status: 429 });
      for (let i = 0; i < 10; i++) {
        middleware(
          fakeRequest({
            pathname: "/api/jobs/ingest",
            method: "POST",
            headers: { "x-forwarded-for": "10.0.0.1" },
          }),
        );
      }
      middleware(
        fakeRequest({
          pathname: "/api/jobs/ingest",
          method: "POST",
          headers: { "x-forwarded-for": "10.0.0.1" },
        }),
      );
      expect(mockJson).toHaveBeenCalled();
    });

    it("ingestion limit is independent of generic API limit", () => {
      mockNext.mockReturnValue({ passed: true });
      // Use up the generic API limit on a different path
      for (let i = 0; i < 30; i++) {
        middleware(
          fakeRequest({
            pathname: "/api/sources",
            method: "POST",
            headers: { "x-forwarded-for": "11.0.0.1" },
          }),
        );
      }
      // Ingestion uses a separate key, should still work
      mockJson.mockClear();
      const result = middleware(
        fakeRequest({
          pathname: "/api/jobs/ingest",
          method: "POST",
          headers: { "x-forwarded-for": "11.0.0.1" },
        }),
      );
      expect(result).toEqual({ passed: true });
      expect(mockJson).not.toHaveBeenCalled();
    });
  });

  describe("maintenance", () => {
    it("allows POST /api/internal/maintenance/run within limit", () => {
      mockNext.mockReturnValue({ passed: true });
      for (let i = 0; i < 3; i++) {
        const result = middleware(
          fakeRequest({
            pathname: "/api/internal/maintenance/run",
            method: "POST",
            headers: { "x-forwarded-for": "12.0.0.1" },
          }),
        );
        expect(result).toEqual({ passed: true });
      }
      expect(mockJson).not.toHaveBeenCalled();
    });

    it("blocks POST /api/internal/maintenance/run after 3 attempts", () => {
      mockJson.mockReturnValue({ status: 429 });
      for (let i = 0; i < 3; i++) {
        middleware(
          fakeRequest({
            pathname: "/api/internal/maintenance/run",
            method: "POST",
            headers: { "x-forwarded-for": "12.0.0.1" },
          }),
        );
      }
      middleware(
        fakeRequest({
          pathname: "/api/internal/maintenance/run",
          method: "POST",
          headers: { "x-forwarded-for": "12.0.0.1" },
        }),
      );
      expect(mockJson).toHaveBeenCalled();
    });
  });

  describe("shared default bucket", () => {
    it("different spoofed x-forwarded-for values no longer create independent buckets", () => {
      mockNext.mockReturnValue({ passed: true });
      // Use up the API limit with one spoofed XFF value
      for (let i = 0; i < 30; i++) {
        middleware(
          fakeRequest({
            pathname: "/api/jobs",
            method: "POST",
            headers: { "x-forwarded-for": "20.0.0.1" },
          }),
        );
      }
      // A different spoofed XFF is still blocked — they share the default bucket
      mockJson.mockReturnValue({ status: 429 });
      middleware(
        fakeRequest({
          pathname: "/api/jobs",
          method: "POST",
          headers: { "x-forwarded-for": "20.0.0.2" },
        }),
      );
      expect(mockJson).toHaveBeenCalled();
    });
  });

  describe("trusted client-IP resolution (Batch 63)", () => {
    it("ignores spoofed x-forwarded-for: rotating XFF cannot bypass the limit", () => {
      mockJson.mockReturnValue({ status: 429 });
      // Five login attempts, each with a different spoofed XFF
      for (let i = 0; i < 5; i++) {
        middleware(
          fakeRequest({
            pathname: "/login",
            method: "POST",
            headers: { "x-forwarded-for": `10.0.0.${i + 1}` },
          }),
        );
        expect(mockJson).not.toHaveBeenCalled();
      }
      // A sixth login with yet another spoofed XFF is blocked: the attacker
      // cannot rotate the rate-limit identity.
      middleware(
        fakeRequest({
          pathname: "/login",
          method: "POST",
          headers: { "x-forwarded-for": "10.0.0.99" },
        }),
      );
      expect(mockJson).toHaveBeenCalled();
      expect(mockJson.mock.calls[0][1].status).toBe(429);
    });

    it("uses the configured TRUSTED_CLIENT_IP_HEADER even when XFF conflicts", () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = "x-real-ip";
      mockNext.mockReturnValue({ passed: true });
      mockJson.mockReturnValue({ status: 429 });
      // Five attempts with a fixed trusted IP and rotating spoofed XFF
      for (let i = 0; i < 5; i++) {
        const result = middleware(
          fakeRequest({
            pathname: "/login",
            method: "POST",
            headers: {
              "x-real-ip": "203.0.113.9",
              "x-forwarded-for": `198.51.100.${i + 1}`,
            },
          }),
        );
        expect(result).toEqual({ passed: true });
      }
      // A sixth attempt (new XFF, same trusted IP) is blocked
      middleware(
        fakeRequest({
          pathname: "/login",
          method: "POST",
          headers: {
            "x-real-ip": "203.0.113.9",
            "x-forwarded-for": "198.51.100.99",
          },
        }),
      );
      expect(mockJson).toHaveBeenCalled();
    });

    it("trusted header restores per-client identity", () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = "x-real-ip";
      mockNext.mockReturnValue({ passed: true });
      mockJson.mockReturnValue({ status: 429 });
      // Exhaust the login limit for client A
      for (let i = 0; i < 5; i++) {
        middleware(
          fakeRequest({
            pathname: "/login",
            method: "POST",
            headers: { "x-real-ip": "203.0.113.9" },
          }),
        );
      }
      // Client B is not affected — distinct trusted identity
      const result = middleware(
        fakeRequest({
          pathname: "/login",
          method: "POST",
          headers: { "x-real-ip": "203.0.113.10" },
        }),
      );
      expect(result).toEqual({ passed: true });
      expect(mockJson).not.toHaveBeenCalled();
    });

    it("selects the leftmost value from a comma-separated trusted header", () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = "x-forwarded-for";
      mockNext.mockReturnValue({ passed: true });
      mockJson.mockReturnValue({ status: 429 });
      // Five attempts whose trusted header shares a leftmost client IP but
      // differs in the proxy chain that follows it
      for (let i = 0; i < 5; i++) {
        const result = middleware(
          fakeRequest({
            pathname: "/login",
            method: "POST",
            headers: {
              "x-forwarded-for": `203.0.113.9, 10.0.0.${i + 1}`,
            },
          }),
        );
        expect(result).toEqual({ passed: true });
      }
      // A sixth attempt with the same leftmost client IP is blocked
      middleware(
        fakeRequest({
          pathname: "/login",
          method: "POST",
          headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.99" },
        }),
      );
      expect(mockJson).toHaveBeenCalled();
    });

    it("accepts IPv6 values in the trusted header", () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = "x-real-ip";
      mockJson.mockReturnValue({ status: 429 });
      for (let i = 0; i < 5; i++) {
        middleware(
          fakeRequest({
            pathname: "/login",
            method: "POST",
            headers: { "x-real-ip": "2001:db8::1" },
          }),
        );
      }
      middleware(
        fakeRequest({
          pathname: "/login",
          method: "POST",
          headers: { "x-real-ip": "2001:db8::1" },
        }),
      );
      expect(mockJson).toHaveBeenCalled();
    });

    it("falls back to the shared bucket when the trusted header is malformed or empty", () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = "x-real-ip";
      mockJson.mockReturnValue({ status: 429 });
      // Five attempts with a malformed trusted-header value
      for (let i = 0; i < 5; i++) {
        middleware(
          fakeRequest({
            pathname: "/login",
            method: "POST",
            headers: { "x-real-ip": "not-an-ip 123" },
          }),
        );
        expect(mockJson).not.toHaveBeenCalled();
      }
      // A sixth attempt with an empty trusted-header value shares the same
      // fallback bucket and is blocked
      middleware(
        fakeRequest({
          pathname: "/login",
          method: "POST",
          headers: { "x-real-ip": "" },
        }),
      );
      expect(mockJson).toHaveBeenCalled();
    });
  });

  describe("non-matched routes", () => {
    it("passes through public pages without rate limiting", () => {
      mockNext.mockReturnValue({ passed: true });
      for (let i = 0; i < 10; i++) {
        middleware(
          fakeRequest({
            pathname: "/jobs",
            method: "GET",
          }),
        );
      }
      expect(mockJson).not.toHaveBeenCalled();
    });
  });
});
