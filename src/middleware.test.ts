import { describe, it, expect, vi, beforeEach } from "vitest";
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

  describe("different IPs are independent", () => {
    it("does not share limits across IPs", () => {
      mockNext.mockReturnValue({ passed: true });
      // Use up the API limit for IP A
      for (let i = 0; i < 30; i++) {
        middleware(
          fakeRequest({
            pathname: "/api/jobs",
            method: "POST",
            headers: { "x-forwarded-for": "20.0.0.1" },
          }),
        );
      }
      // IP B should still be allowed
      mockJson.mockClear();
      const result = middleware(
        fakeRequest({
          pathname: "/api/jobs",
          method: "POST",
          headers: { "x-forwarded-for": "20.0.0.2" },
        }),
      );
      expect(result).toEqual({ passed: true });
      expect(mockJson).not.toHaveBeenCalled();
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
