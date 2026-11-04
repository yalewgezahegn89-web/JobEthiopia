import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  GOOGLE_OAUTH_COOKIE_MAX_AGE,
  GOOGLE_OAUTH_COOKIE_PATH,
  GOOGLE_OAUTH_LOCALE_COOKIE,
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
} from "@/lib/auth/googleOAuth";

const mocks = vi.hoisted(() => ({
  jar: new Map<string, { value: string; options?: Record<string, unknown> }>(),
  generateCodeVerifierAsync: vi.fn(),
  generateAuthUrl: vi.fn(),
  getToken: vi.fn(),
  verifyIdToken: vi.fn(),
  authenticate: vi.fn(),
  createSession: vi.fn(),
  payload: null as Record<string, unknown> | null,
  lastAuthOptions: null as Record<string, unknown> | null,
  lastClientOptions: null as Record<string, unknown> | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = mocks.jar.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: (
      name: string,
      value: string,
      options?: Record<string, unknown>,
    ) => {
      mocks.jar.set(name, { value, options });
    },
  }),
}));

vi.mock("google-auth-library", () => ({
  CodeChallengeMethod: { S256: "S256" },
  OAuth2Client: class {
    constructor(options: Record<string, unknown>) {
      mocks.lastClientOptions = options;
    }
    async generateCodeVerifierAsync() {
      return mocks.generateCodeVerifierAsync();
    }
    generateAuthUrl(options: Record<string, unknown>) {
      mocks.lastAuthOptions = options;
      return mocks.generateAuthUrl(options);
    }
    async getToken(options: Record<string, unknown>) {
      return mocks.getToken(options);
    }
    async verifyIdToken(options: Record<string, unknown>) {
      return mocks.verifyIdToken(options);
    }
  },
}));

vi.mock("@/lib/auth/google", () => ({
  authenticateGoogleIdentity: (...args: unknown[]) =>
    mocks.authenticate(...args),
  isValidGoogleEmail: (value: string) => {
    const email = value.trim();
    if (!email || email.length > 254 || /\s/.test(email)) return false;
    const parts = email.split("@");
    return parts.length === 2 && parts[0].length > 0 && parts[1].includes(".");
  },
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: (...args: unknown[]) => mocks.createSession(...args),
  SESSION_COOKIE_NAME: "session",
  SESSION_DURATION_MS: 7 * 24 * 60 * 60 * 1000,
}));

import { GET as startGoogle } from "@/app/api/auth/google/start/route";
import { GET as callbackGoogle } from "@/app/api/auth/google/callback/route";

const VALID_STATE = "state-123";
const VALID_NONCE = "nonce-123";
const VALID_VERIFIER = "verifier-123";
const VALID_CODE = "auth-code-123";
const ID_TOKEN = "id-token-123";
const ACCESS_TOKEN = "access-token-123";

function validPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://accounts.google.com",
    aud: "client-id",
    exp: now + 3600,
    iat: now,
    nonce: VALID_NONCE,
    sub: "google-sub-1",
    email: "user@example.com",
    email_verified: true,
    name: "Google User",
    given_name: "Google",
    family_name: "User",
    ...overrides,
  };
}

function setOAuthCookies(
  overrides: Partial<Record<string, string | null>> = {},
): void {
  const values: Record<string, string | null> = {
    [GOOGLE_OAUTH_STATE_COOKIE]: VALID_STATE,
    [GOOGLE_OAUTH_VERIFIER_COOKIE]: VALID_VERIFIER,
    [GOOGLE_OAUTH_NONCE_COOKIE]: VALID_NONCE,
    [GOOGLE_OAUTH_LOCALE_COOKIE]: "en",
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) {
    if (value === null) mocks.jar.delete(name);
    else mocks.jar.set(name, { value });
  }
}

function startRequest(locale?: string): NextRequest {
  const url = new URL("http://localhost:3000/api/auth/google/start");
  if (locale) url.searchParams.set("locale", locale);
  return new NextRequest(url);
}

function callbackRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/auth/google/callback");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

function callbackSuccessRequest(): NextRequest {
  return callbackRequest({ code: VALID_CODE, state: VALID_STATE });
}

function locationOf(response: { headers: Headers }): URL {
  return new URL(response.headers.get("location") ?? "");
}

function cookieHeader(response: { headers: Headers }): string {
  return response.headers.get("set-cookie") ?? "";
}

function expectOAuthCookiesCleared(response: { headers: Headers }): void {
  const header = cookieHeader(response);
  for (const name of [
    GOOGLE_OAUTH_STATE_COOKIE,
    GOOGLE_OAUTH_VERIFIER_COOKIE,
    GOOGLE_OAUTH_NONCE_COOKIE,
    GOOGLE_OAUTH_LOCALE_COOKIE,
  ]) {
    expect(header).toContain(`${name}=;`);
    expect(header).toMatch(new RegExp(`${name}=;[^,]*Max-Age=0`));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.jar.clear();
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");

  mocks.generateCodeVerifierAsync.mockResolvedValue({
    codeVerifier: VALID_VERIFIER,
    codeChallenge: "challenge-123",
  });
  mocks.generateAuthUrl.mockReturnValue(
    "https://accounts.google.com/o/oauth2/v2/auth?client_id=client-id&response_type=code",
  );
  mocks.getToken.mockResolvedValue({
    tokens: { id_token: ID_TOKEN, access_token: ACCESS_TOKEN },
  });
  mocks.payload = validPayload();
  mocks.verifyIdToken.mockImplementation(async () => ({
    getPayload: () => mocks.payload,
  }));
  mocks.authenticate.mockResolvedValue({
    ok: true,
    created: true,
    user: {
      id: "user-1",
      role: "CANDIDATE",
      name: "Google User",
      email: "user@example.com",
      isActive: true,
    },
  });
  mocks.createSession.mockResolvedValue("raw-session-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/auth/google/start", () => {
  it("redirects to the localized login page when credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

    const response = await startGoogle(startRequest("am"));
    const location = locationOf(response);

    expect(location.pathname).toBe("/am/login");
    expect(location.searchParams.get("googleError")).toBe("1");
    expect(mocks.generateCodeVerifierAsync).not.toHaveBeenCalled();
    expect(mocks.jar.size).toBe(0);
  });

  it("builds a Google authorization URL with state, nonce, and PKCE S256", async () => {
    const response = await startGoogle(startRequest("en"));
    const location = locationOf(response);

    expect(location.origin).toBe("https://accounts.google.com");
    expect(mocks.lastAuthOptions).toMatchObject({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
      code_challenge: "challenge-123",
      code_challenge_method: "S256",
    });
    expect(typeof mocks.lastAuthOptions?.state).toBe("string");
    const nonce = location.searchParams.get("nonce");
    expect(nonce).toBeTruthy();

    expect(mocks.jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value).toBe(
      mocks.lastAuthOptions?.state,
    );
    expect(mocks.jar.get(GOOGLE_OAUTH_VERIFIER_COOKIE)?.value).toBe(
      VALID_VERIFIER,
    );
    expect(mocks.jar.get(GOOGLE_OAUTH_NONCE_COOKIE)?.value).toBe(nonce);
    expect(mocks.jar.get(GOOGLE_OAUTH_LOCALE_COOKIE)?.value).toBe("en");
  });

  it("sets short-lived HttpOnly SameSite=Lax route-scoped OAuth cookies", async () => {
    await startGoogle(startRequest("en"));

    for (const name of [
      GOOGLE_OAUTH_STATE_COOKIE,
      GOOGLE_OAUTH_VERIFIER_COOKIE,
      GOOGLE_OAUTH_NONCE_COOKIE,
      GOOGLE_OAUTH_LOCALE_COOKIE,
    ]) {
      const options = mocks.jar.get(name)?.options;
      expect(options).toMatchObject({
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: GOOGLE_OAUTH_COOKIE_PATH,
        maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE,
      });
    }
  });
});

describe("GET /api/auth/google/callback", () => {
  it("creates a session and redirects a new candidate to jobs", async () => {
    setOAuthCookies();

    const response = await callbackGoogle(callbackSuccessRequest());
    const location = locationOf(response);
    const header = cookieHeader(response);

    expect(location.pathname).toBe("/jobs");
    expect(location.search).toBe("");
    expect(header).toContain("session=raw-session-token");
    expectOAuthCookiesCleared(response);

    expect(mocks.getToken).toHaveBeenCalledWith(
      expect.objectContaining({
        code: VALID_CODE,
        codeVerifier: VALID_VERIFIER,
        redirect_uri: "http://localhost:3000/api/auth/google/callback",
      }),
    );
    expect(mocks.verifyIdToken).toHaveBeenCalledWith({
      idToken: ID_TOKEN,
      audience: "client-id",
    });
    expect(mocks.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "google-sub-1",
        email: "user@example.com",
        emailVerified: true,
        name: "Google User",
      }),
    );
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
  });

  it("does not expose OAuth codes, state, verifier, nonce, or provider tokens", async () => {
    setOAuthCookies();

    const response = await callbackGoogle(callbackSuccessRequest());
    const serialized = JSON.stringify({
      location: response.headers.get("location"),
      cookie: response.headers.get("set-cookie"),
    });

    for (const secret of [
      VALID_CODE,
      VALID_STATE,
      VALID_VERIFIER,
      VALID_NONCE,
      ID_TOKEN,
      ACCESS_TOKEN,
      "client-secret",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("does not write OAuth secrets to the console", async () => {
    setOAuthCookies();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await callbackGoogle(callbackSuccessRequest());

    const serialized = JSON.stringify([
      ...info.mock.calls,
      ...warn.mock.calls,
      ...error.mock.calls,
    ]);
    for (const secret of [
      VALID_CODE,
      VALID_STATE,
      VALID_VERIFIER,
      VALID_NONCE,
      ID_TOKEN,
      ACCESS_TOKEN,
      "client-secret",
    ]) {
      expect(serialized).not.toContain(secret);
    }

    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });

  it("handles provider cancellation without exchanging a code", async () => {
    setOAuthCookies();

    const response = await callbackGoogle(
      callbackRequest({ error: "access_denied", state: VALID_STATE }),
    );

    expect(locationOf(response).pathname).toBe("/login");
    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
    expectOAuthCookiesCleared(response);
  });

  it("rejects a missing authorization code", async () => {
    setOAuthCookies();

    const response = await callbackGoogle(
      callbackRequest({ state: VALID_STATE }),
    );

    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.getToken).not.toHaveBeenCalled();
    expectOAuthCookiesCleared(response);
  });

  it("rejects a missing state cookie", async () => {
    setOAuthCookies({ [GOOGLE_OAUTH_STATE_COOKIE]: null });

    const response = await callbackGoogle(callbackSuccessRequest());

    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.getToken).not.toHaveBeenCalled();
    expectOAuthCookiesCleared(response);
  });

  it("rejects a mismatched state", async () => {
    setOAuthCookies({ [GOOGLE_OAUTH_STATE_COOKIE]: "a-different-state" });

    const response = await callbackGoogle(callbackSuccessRequest());

    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.getToken).not.toHaveBeenCalled();
    expectOAuthCookiesCleared(response);
  });

  it("rejects missing verifier or nonce cookies", async () => {
    setOAuthCookies({ [GOOGLE_OAUTH_VERIFIER_COOKIE]: null });
    const missingVerifier = await callbackGoogle(callbackSuccessRequest());
    expect(locationOf(missingVerifier).searchParams.get("googleError")).toBe("1");

    setOAuthCookies({ [GOOGLE_OAUTH_NONCE_COOKIE]: null });
    const missingNonce = await callbackGoogle(callbackSuccessRequest());
    expect(locationOf(missingNonce).searchParams.get("googleError")).toBe("1");

    expect(mocks.getToken).not.toHaveBeenCalled();
  });

  it("rejects callbacks when server credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    setOAuthCookies();

    const response = await callbackGoogle(callbackSuccessRequest());

    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.getToken).not.toHaveBeenCalled();
    expectOAuthCookiesCleared(response);
  });

  it("fails safely when the token exchange fails", async () => {
    setOAuthCookies();
    mocks.getToken.mockRejectedValue(new Error("exchange failed"));

    const response = await callbackGoogle(callbackSuccessRequest());

    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
    expectOAuthCookiesCleared(response);
  });

  it("fails safely when the ID token has an invalid signature", async () => {
    setOAuthCookies();
    mocks.verifyIdToken.mockRejectedValue(new Error("invalid signature"));

    const response = await callbackGoogle(callbackSuccessRequest());

    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expectOAuthCookiesCleared(response);
  });

  it("rejects an invalid issuer", async () => {
    setOAuthCookies();
    mocks.payload = validPayload({ iss: "https://evil.example" });

    const response = await callbackGoogle(callbackSuccessRequest());

    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects a wrong audience", async () => {
    setOAuthCookies();
    mocks.payload = validPayload({ aud: "another-client" });

    const response = await callbackGoogle(callbackSuccessRequest());

    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects an expired token and an issued-at time in the far future", async () => {
    const now = Math.floor(Date.now() / 1000);
    setOAuthCookies();
    mocks.payload = validPayload({ exp: now - 10 });

    const expired = await callbackGoogle(callbackSuccessRequest());
    expect(locationOf(expired).searchParams.get("googleError")).toBe("1");

    mocks.payload = validPayload({ iat: now + 120 });
    const future = await callbackGoogle(callbackSuccessRequest());
    expect(locationOf(future).searchParams.get("googleError")).toBe("1");

    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects a nonce mismatch", async () => {
    setOAuthCookies();
    mocks.payload = validPayload({ nonce: "different-nonce" });

    const response = await callbackGoogle(callbackSuccessRequest());

    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expectOAuthCookiesCleared(response);
  });

  it("rejects a missing subject", async () => {
    setOAuthCookies();
    mocks.payload = validPayload({ sub: "  " });

    const response = await callbackGoogle(callbackSuccessRequest());

    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed email", async () => {
    setOAuthCookies();
    mocks.payload = validPayload({ email: "" });
    const missing = await callbackGoogle(callbackSuccessRequest());
    expect(locationOf(missing).searchParams.get("googleError")).toBe("1");

    mocks.payload = validPayload({ email: "not-an-email" });
    const malformed = await callbackGoogle(callbackSuccessRequest());
    expect(locationOf(malformed).searchParams.get("googleError")).toBe("1");

    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it("requires email_verified to be exactly true", async () => {
    setOAuthCookies();
    mocks.payload = validPayload({ email_verified: false });

    const response = await callbackGoogle(callbackSuccessRequest());

    expect(locationOf(response).searchParams.get("googleError")).toBe("1");
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it("shows a safe conflict message without linking an existing email", async () => {
    setOAuthCookies();
    mocks.authenticate.mockResolvedValue({
      ok: false,
      reason: "email_conflict",
    });

    const response = await callbackGoogle(callbackSuccessRequest());

    expect(locationOf(response).pathname).toBe("/login");
    expect(locationOf(response).searchParams.get("googleConflict")).toBe("1");
    expect(locationOf(response).searchParams.get("googleError")).toBeNull();
    expect(mocks.createSession).not.toHaveBeenCalled();
    expectOAuthCookiesCleared(response);
  });

  it("routes existing staff and organization accounts by their stored role", async () => {
    setOAuthCookies();
    mocks.authenticate.mockResolvedValue({
      ok: true,
      created: false,
      user: {
        id: "admin-1",
        role: "ADMIN",
        name: "Admin",
        email: "admin@example.com",
        isActive: true,
      },
    });
    const admin = await callbackGoogle(callbackSuccessRequest());
    expect(locationOf(admin).pathname).toBe("/admin");

    mocks.authenticate.mockResolvedValue({
      ok: true,
      created: false,
      user: {
        id: "org-1",
        role: "ORGANIZATION_ADMIN",
        name: "Org",
        email: "org@example.com",
        isActive: true,
      },
    });
    const organization = await callbackGoogle(callbackSuccessRequest());
    expect(locationOf(organization).pathname).toBe(
      "/organization/applications",
    );
  });

  it("uses localized redirects for success and failure", async () => {
    setOAuthCookies({ [GOOGLE_OAUTH_LOCALE_COOKIE]: "am" });

    const success = await callbackGoogle(callbackSuccessRequest());
    expect(locationOf(success).pathname).toBe("/am/jobs");

    setOAuthCookies({
      [GOOGLE_OAUTH_LOCALE_COOKIE]: "am",
      [GOOGLE_OAUTH_STATE_COOKIE]: null,
    });
    const failure = await callbackGoogle(callbackSuccessRequest());
    expect(locationOf(failure).pathname).toBe("/am/login");
    expect(locationOf(failure).searchParams.get("googleError")).toBe("1");
  });
});
