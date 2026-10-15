import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import {
  localeFromPathname,
  isPrefixedPath,
  stripLocalePrefix,
  localizePath,
  detectPathLocale,
} from "@/lib/i18n/routing";
import { LOCALE_COOKIE_NAME, LOCALE_HEADER } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockNext: vi.fn(),
  mockJson: vi.fn(),
  mockRewrite: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: mocks.mockRedirect,
    next: mocks.mockNext,
    json: mocks.mockJson,
    rewrite: mocks.mockRewrite,
  },
}));

const mockRedirect = mocks.mockRedirect;
const mockNext = mocks.mockNext;
const mockRewrite = mocks.mockRewrite;

import { middleware } from "@/middleware";

function fakeRequest(
  overrides: {
    cookieValue?: string;
    pathname?: string;
    method?: string;
    headers?: Record<string, string>;
    url?: string;
  } = {},
): NextRequest {
  const {
    cookieValue,
    pathname = "/",
    method = "GET",
    headers = {},
    url = "https://jobethiopia.et",
  } = overrides;
  const requestHeaders = new Headers(
    Object.entries(headers).map(
      ([name, value]) => [name, value] as [string, string],
    ),
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
    url,
  } as unknown as NextRequest;
}

function requestHeadersFromLastCall(): Headers {
  const [init] = mockNext.mock.calls[mockNext.mock.calls.length - 1];
  return (init?.request?.headers as Headers) ?? new Headers();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("i18n routing helpers", () => {
  describe("localeFromPathname", () => {
    it("detects am from a prefixed path", () => {
      expect(localeFromPathname("/am/jobs")).toBe("am");
      expect(localeFromPathname("/am")).toBe("am");
    });

    it("detects om from a prefixed path", () => {
      expect(localeFromPathname("/om/jobs")).toBe("om");
      expect(localeFromPathname("/om")).toBe("om");
    });

    it("returns null for the unprefixed (en) path", () => {
      expect(localeFromPathname("/jobs")).toBeNull();
      expect(localeFromPathname("/")).toBeNull();
    });

    it("returns null for an invalid locale prefix", () => {
      expect(localeFromPathname("/fr/jobs")).toBeNull();
    });
  });

  describe("isPrefixedPath", () => {
    it("is true for locale branches", () => {
      expect(isPrefixedPath("/am")).toBe(true);
      expect(isPrefixedPath("/am/jobs")).toBe(true);
      expect(isPrefixedPath("/om")).toBe(true);
      expect(isPrefixedPath("/om/jobs")).toBe(true);
    });

    it("is false for unprefixed and unrelated paths", () => {
      expect(isPrefixedPath("/jobs")).toBe(false);
      expect(isPrefixedPath("/")).toBe(false);
      expect(isPrefixedPath("/admin")).toBe(false);
      expect(isPrefixedPath("/fr/jobs")).toBe(false);
    });
  });

  describe("stripLocalePrefix", () => {
    it("strips /am from a prefixed path", () => {
      expect(stripLocalePrefix("/am/jobs")).toBe("/jobs");
    });

    it("strips /om from a prefixed path", () => {
      expect(stripLocalePrefix("/om/jobs")).toBe("/jobs");
    });

    it("maps the bare locale branch to the root", () => {
      expect(stripLocalePrefix("/am")).toBe("/");
      expect(stripLocalePrefix("/om")).toBe("/");
    });

    it("returns the path unchanged when unprefixed", () => {
      expect(stripLocalePrefix("/jobs")).toBe("/jobs");
      expect(stripLocalePrefix("/")).toBe("/");
    });
  });

  describe("localizePath", () => {
    it("returns the cleaned path for the en (default) locale", () => {
      expect(localizePath("/jobs", "en")).toBe("/jobs");
      expect(localizePath("/am/jobs", "en")).toBe("/jobs");
    });

    it("prefixes the requested locale onto an unprefixed path", () => {
      expect(localizePath("/jobs", "am")).toBe("/am/jobs");
      expect(localizePath("/jobs", "om")).toBe("/om/jobs");
    });

    it("replaces an existing locale prefix when switching locales", () => {
      expect(localizePath("/am/jobs", "om")).toBe("/om/jobs");
      expect(localizePath("/om/jobs", "am")).toBe("/am/jobs");
    });

    it("maps the root path to the bare locale branch", () => {
      expect(localizePath("/", "am")).toBe("/am");
      expect(localizePath("/", "om")).toBe("/om");
    });
  });

  describe("detectPathLocale", () => {
    it("returns a valid locale when given one", () => {
      expect(detectPathLocale("am")).toBe("am");
      expect(detectPathLocale("om")).toBe("om");
      expect(detectPathLocale("en")).toBe("en");
    });

    it("falls back to the default locale for invalid input", () => {
      expect(detectPathLocale("fr")).toBe("en");
      expect(detectPathLocale("")).toBe("en");
      expect(detectPathLocale(null)).toBe("en");
      expect(detectPathLocale(undefined)).toBe("en");
    });
  });
});

describe("middleware — i18n locale resolution", () => {
  it("resolves locale am for a /am/jobs request", () => {
    const headers = new Headers();
    mockRewrite.mockReturnValue({ rewritten: true, headers });
    mockNext.mockReturnValue({ passed: true, headers });

    middleware(fakeRequest({ pathname: "/am/jobs" }));

    expect(mockRewrite).toHaveBeenCalled();
    const [url, init] = mockRewrite.mock.calls[0];
    const rewritten = new URL(url);
    expect(rewritten.pathname).toBe("/jobs");
    expect((init.request.headers as Headers).get(LOCALE_HEADER)).toBe("am");
  });

  it("resolves locale om for an /om request", () => {
    const headers = new Headers();
    mockRewrite.mockReturnValue({ rewritten: true, headers });
    mockNext.mockReturnValue({ passed: true, headers });

    middleware(fakeRequest({ pathname: "/om" }));

    expect(mockRewrite).toHaveBeenCalled();
    const [url, init] = mockRewrite.mock.calls[0];
    const rewritten = new URL(url);
    expect(rewritten.pathname).toBe("/");
    expect((init.request.headers as Headers).get(LOCALE_HEADER)).toBe("om");
  });

  it("uses en for an unprefixed /jobs request", () => {
    const headers = new Headers();
    mockNext.mockReturnValue({ passed: true, headers });

    middleware(fakeRequest({ pathname: "/jobs" }));

    expect(mockNext).toHaveBeenCalled();
    expect(mockRewrite).not.toHaveBeenCalled();
    expect(requestHeadersFromLastCall().get(LOCALE_HEADER)).toBe("en");
  });

  it("falls back to en for an invalid /fr/jobs locale prefix", () => {
    const headers = new Headers();
    mockNext.mockReturnValue({ passed: true, headers });

    middleware(fakeRequest({ pathname: "/fr/jobs" }));

    expect(mockNext).toHaveBeenCalled();
    expect(mockRewrite).not.toHaveBeenCalled();
    expect(requestHeadersFromLastCall().get(LOCALE_HEADER)).toBe("en");
  });

  it("sets the locale cookie on the response", () => {
    const headers = new Headers();
    mockRewrite.mockReturnValue({ rewritten: true, headers });

    middleware(fakeRequest({ pathname: "/am/jobs" }));

    const cookie = headers
      .get("Set-Cookie")
      ?.match(
        new RegExp(`^${LOCALE_COOKIE_NAME}=([^;]+);\\s*Path=/;.*SameSite=Lax`),
      );
    expect(cookie).toBeTruthy();
    expect(cookie?.[1]).toBe("am");
  });
});

describe("middleware — protected routes remain protected with locale prefixes", () => {
  it("redirects /am/admin to login without a session cookie", () => {
    mockRedirect.mockReturnValue({ redirected: true });

    middleware(fakeRequest({ pathname: "/am/admin" }));

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect.mock.calls[0][0].pathname).toBe("/login");
  });

  it("does not redirect /am/admin when a session cookie exists", () => {
    mockNext.mockReturnValue({ passed: true });
    middleware(fakeRequest({ cookieValue: "token", pathname: "/am/admin" }));
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects /om/organization to login without a session cookie", () => {
    mockRedirect.mockReturnValue({ redirected: true });

    middleware(fakeRequest({ pathname: "/om/organization" }));

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect.mock.calls[0][0].pathname).toBe("/login");
  });

  it("does not redirect /om/organization when a session cookie exists", () => {
    mockNext.mockReturnValue({ passed: true });
    middleware(
      fakeRequest({ cookieValue: "token", pathname: "/om/organization" }),
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("does not redirect public /am/organizations (prefix boundary respected)", () => {
    const headers = new Headers();
    mockRewrite.mockReturnValue({ rewritten: true, headers });
    mockNext.mockReturnValue({ passed: true, headers });

    middleware(fakeRequest({ pathname: "/am/organizations" }));

    expect(mockRedirect).not.toHaveBeenCalled();
    const [url, init] = mockRewrite.mock.calls[0];
    const rewritten = new URL(url);
    expect(rewritten.pathname).toBe("/organizations");
    expect((init.request.headers as Headers).get(LOCALE_HEADER)).toBe("am");
  });
});

describe("middleware — org section protected/public boundary", () => {
  const protectedPaths = [
    "/organization",
    "/organization/jobs",
    "/organization/jobs/create",
    "/am/organization",
    "/am/organization/jobs",
    "/om/organization",
    "/om/organization/team",
  ];

  it.each(protectedPaths)(
    "redirects %s to login without a session cookie",
    (pathname) => {
      mockRedirect.mockReturnValue({ redirected: true });
      middleware(fakeRequest({ pathname }));

      expect(mockRedirect).toHaveBeenCalledTimes(1);
      expect(mockRedirect.mock.calls[0][0].pathname).toBe("/login");
    },
  );

  it.each(protectedPaths)(
    "does not redirect %s when a session cookie exists",
    (pathname) => {
      mockNext.mockReturnValue({ passed: true });
      middleware(fakeRequest({ cookieValue: "token", pathname }));

      expect(mockRedirect).not.toHaveBeenCalled();
    },
  );

  const publicPaths = [
    "/organizations",
    "/organizations/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "/am/organizations",
    "/am/organizations/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "/om/organizations",
    "/om/organizations/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  ];

  it.each(publicPaths)(
    "does not redirect public %s without a session cookie",
    (pathname) => {
      const headers = new Headers();
      mockRewrite.mockReturnValue({ rewritten: true, headers });
      mockNext.mockReturnValue({ passed: true, headers });

      middleware(fakeRequest({ pathname }));

      expect(mockRedirect).not.toHaveBeenCalled();
    },
  );
});

describe("middleware — admin section protected/public boundary", () => {
  it.each(["/admin", "/admin/users", "/am/admin", "/am/admin/users", "/om/admin"])(
    "redirects %s to login without a session cookie",
    (pathname) => {
      mockRedirect.mockReturnValue({ redirected: true });
      middleware(fakeRequest({ pathname }));

      expect(mockRedirect).toHaveBeenCalledTimes(1);
      expect(mockRedirect.mock.calls[0][0].pathname).toBe("/login");
    },
  );

  it("does not redirect public /administrators (prefix boundary respected)", () => {
    const headers = new Headers();
    mockRewrite.mockReturnValue({ rewritten: true, headers });
    mockNext.mockReturnValue({ passed: true, headers });

    middleware(fakeRequest({ pathname: "/am/administrators" }));

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
