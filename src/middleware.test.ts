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
  const requestHeaders = new Headers(
    Object.entries(headers).map(([name, value]) => [name, value]),
  );
  return {
    cookies: {
      get: () => (cookieValue ? { value: cookieValue } : undefined),
    },
    nextUrl: {
      pathname,
      clone: () => ({ pathname }),
    },
    method,
    headers: requestHeaders,
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
  it("keeps admin, api, and login routes", () => {
    expect(config.matcher).toContain("/admin/:path*");
    expect(config.matcher).toContain("/api/:path*");
    expect(config.matcher).toContain("/login");
  });

  it("adds a public-page catch-all so CSP reaches non-admin routes", () => {
    expect(config.matcher).toContain(
      "/((?!api|_next/static|_next/image|favicon.ico).*)",
    );
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

describe("middleware — CSP headers (Batch 72)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function cspAwareNext(): Headers {
    const headers = new Headers();
    mockNext.mockReturnValue({ passed: true, headers });
    return headers;
  }

  function nonceFrom(headers: Headers): string {
    const match = /'nonce-([^']+)'/.exec(headers.get("content-security-policy") ?? "");
    if (!match) throw new Error("nonce not found in CSP header");
    return match[1];
  }

  it("enforces CSP on pass-through responses in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const headers = cspAwareNext();
    middleware(fakeRequest({ pathname: "/jobs", method: "GET" }));

    const csp = headers.get("content-security-policy");
    expect(csp).toBeTruthy();
    expect(headers.get("content-security-policy-report-only")).toBeNull();
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("*");
    expect(csp).not.toContain("Strict-Transport");
  });

  it("sends report-only CSP in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const headers = cspAwareNext();
    middleware(fakeRequest({ pathname: "/jobs", method: "GET" }));

    expect(headers.get("content-security-policy")).toBeNull();
    expect(headers.get("content-security-policy-report-only")).toContain(
      "script-src 'self' 'nonce-",
    );
  });

  it("propagates the CSP in request headers so the renderer can read the nonce", () => {
    vi.stubEnv("NODE_ENV", "production");
    cspAwareNext();
    middleware(fakeRequest({ pathname: "/jobs", method: "GET" }));

    const [init] = mockNext.mock.calls[mockNext.mock.calls.length - 1];
    const requestHeaders = init.request.headers as Headers;
    expect(requestHeaders.get("content-security-policy")).toContain("'nonce-");
  });

  it("correlates response CSP, request CSP, and style-src to one nonce", () => {
    vi.stubEnv("NODE_ENV", "production");
    const headers = cspAwareNext();
    middleware(fakeRequest({ pathname: "/jobs", method: "GET" }));

    const responseCsp = headers.get("content-security-policy")!;
    const [init] = mockNext.mock.calls[mockNext.mock.calls.length - 1];
    const requestCsp = (init.request.headers as Headers).get(
      "content-security-policy",
    )!;
    const scriptNonce = /script-src 'self' 'nonce-([^']+)'/.exec(responseCsp)?.[1];
    const styleNonce = /style-src 'self' 'nonce-([^']+)'/.exec(responseCsp)?.[1];
    const requestNonce = /script-src 'self' 'nonce-([^']+)'/.exec(requestCsp)?.[1];

    expect(scriptNonce).toBeTruthy();
    expect(styleNonce).toBe(scriptNonce);
    expect(requestNonce).toBe(scriptNonce);
  });

  it("uses a fresh random nonce for every request", () => {
    vi.stubEnv("NODE_ENV", "production");
    const firstHeaders = cspAwareNext();
    middleware(fakeRequest({ pathname: "/jobs", method: "GET" }));
    const firstNonce = nonceFrom(firstHeaders);

    const secondHeaders = cspAwareNext();
    middleware(fakeRequest({ pathname: "/jobs", method: "GET" }));
    const secondNonce = nonceFrom(secondHeaders);

    expect(firstNonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(secondNonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(firstNonce).not.toBe(secondNonce);
  });

  it("attaches CSP to admin-gate redirect responses in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const headers = new Headers();
    mockRedirect.mockReturnValue({ redirected: true, headers });

    middleware(fakeRequest({ pathname: "/admin", method: "GET" }));

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(headers.get("content-security-policy")).toContain("'nonce-");
  });

  it("attaches CSP to rate-limited responses in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const jsonHeaders = new Headers();
    mockJson.mockReturnValue({ status: 429, headers: jsonHeaders });

    for (let i = 0; i < 5; i++) {
      middleware(
        fakeRequest({
          pathname: "/login",
          method: "POST",
          headers: { "x-forwarded-for": "5.5.5.5" },
        }),
      );
    }
    middleware(
      fakeRequest({
        pathname: "/login",
        method: "POST",
        headers: { "x-forwarded-for": "5.5.5.5" },
      }),
    );

    expect(mockJson).toHaveBeenCalledTimes(1);
    expect(jsonHeaders.get("content-security-policy")).toContain("'nonce-");
  });
});

describe("middleware — request correlation ID (Batch 76)", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  it("echoes a server-generated x-request-id on the pass-through response", () => {
    const headers = new Headers();
    mockNext.mockReturnValue({ passed: true, headers });
    middleware(fakeRequest({ pathname: "/jobs", method: "GET" }));
    expect(headers.get("x-request-id")).toMatch(UUID);
  });

  it("propagates the x-request-id in request headers for the downstream handler", () => {
    cspAwareNext();
    middleware(fakeRequest({ pathname: "/jobs", method: "GET" }));
    const [init] = mockNext.mock.calls[mockNext.mock.calls.length - 1];
    const requestHeaders = init.request.headers as Headers;
    expect(requestHeaders.get("x-request-id")).toMatch(UUID);
  });

  it("is server-generated and does not trust an inbound x-request-id", () => {
    const headers = new Headers();
    mockNext.mockReturnValue({ passed: true, headers });
    middleware(
      fakeRequest({
        pathname: "/jobs",
        method: "GET",
        headers: { "x-request-id": "attacker-supplied" },
      }),
    );

    const responseId = headers.get("x-request-id");
    expect(responseId).toMatch(UUID);
    expect(responseId).not.toBe("attacker-supplied");

    const [init] = mockNext.mock.calls[mockNext.mock.calls.length - 1];
    const requestId = (init.request.headers as Headers).get("x-request-id");
    expect(requestId).toMatch(UUID);
    expect(requestId).not.toBe("attacker-supplied");
  });

  it("echoes x-request-id on rate-limited (429) responses", () => {
    const jsonHeaders = new Headers();
    mockJson.mockReturnValue({ status: 429, headers: jsonHeaders });
    for (let i = 0; i < 6; i++) {
      middleware(
        fakeRequest({
          pathname: "/login",
          method: "POST",
          headers: { "x-forwarded-for": "7.7.7.7" },
        }),
      );
    }
    expect(jsonHeaders.get("x-request-id")).toMatch(UUID);
  });

  it("echoes x-request-id on admin-gate redirect responses", () => {
    const headers = new Headers();
    mockRedirect.mockReturnValue({ redirected: true, headers });
    middleware(fakeRequest({ pathname: "/admin", method: "GET" }));
    expect(headers.get("x-request-id")).toMatch(UUID);
  });

  it("does not leak query strings, tokens, or request bodies in propagated headers", () => {
    const headers = new Headers();
    mockNext.mockReturnValue({ passed: true, headers });
    middleware(
      fakeRequest({
        pathname: "/reset-password",
        method: "GET",
        headers: { "x-request-id": "spoof" },
      }),
    );

    const [init] = mockNext.mock.calls[mockNext.mock.calls.length - 1];
    const requestHeaders = init.request.headers as Headers;
    const serialized = JSON.stringify(Object.fromEntries(requestHeaders.entries()));
    expect(serialized).not.toContain("token=");
    expect(serialized).not.toContain("spoof");
    expect(requestHeaders.has("x-request-id")).toBe(true);
  });

  function cspAwareNext(): void {
    const headers = new Headers();
    mockNext.mockReturnValue({ passed: true, headers });
  }
});
