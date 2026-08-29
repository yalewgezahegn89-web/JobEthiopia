import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockNext: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: mocks.mockRedirect,
    next: mocks.mockNext,
  },
}));

const mockRedirect = mocks.mockRedirect;
const mockNext = mocks.mockNext;

import { middleware, config } from "@/middleware";

function fakeRequest(cookieValue?: string): NextRequest {
  return {
    cookies: {
      get: () => (cookieValue ? { value: cookieValue } : undefined),
    },
    nextUrl: {
      clone: () => ({ pathname: "/admin" }),
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("middleware", () => {
  it("redirects to /login when no session cookie is present", () => {
    mockRedirect.mockReturnValue({ redirected: true });

    middleware(fakeRequest(undefined));
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect.mock.calls[0][0].pathname).toBe("/login");
  });

  it("does not redirect when the cookie is empty", () => {
    middleware(fakeRequest(""));
    expect(mockRedirect).toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("allows the request through when a session cookie exists", () => {
    mockNext.mockReturnValue({ passed: true });
    const result = middleware(fakeRequest("some-raw-token"));
    expect(result).toEqual({ passed: true });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("protects only the admin area", () => {
    expect(config.matcher).toEqual(["/admin/:path*"]);
  });
});