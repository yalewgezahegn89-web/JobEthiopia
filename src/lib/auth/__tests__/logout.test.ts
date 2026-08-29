import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockCookieSet: vi.fn(),
  mockCookieDelete: vi.fn(),
  mockSelectRows: vi.fn(),
  mockDeleteWhere: vi.fn(),
  mockInsert: vi.fn(),
  mockRedirect: vi.fn(),
  mockJson: vi.fn(),
  mockCsrf: vi.fn(),
  mockCsrfError: class CsrfError extends Error {
    constructor() {
      super("Unexpected request origin");
      this.name = "CsrfError";
    }
  },
}));

const capturedAuditValues: Record<string, unknown>[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mocks.mockCookieGet,
    set: mocks.mockCookieSet,
    delete: mocks.mockCookieDelete,
  }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: (...args: unknown[]) => mocks.mockRedirect(...args),
    json: (...args: unknown[]) => mocks.mockJson(...args),
  },
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: (...args: unknown[]) =>
    mocks.mockCsrf(...args),
  CsrfError: mocks.mockCsrfError,
}));

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        sessions: { findFirst: vi.fn() },
        users: { findFirst: vi.fn() },
      },
      insert: mocks.mockInsert,
      update: vi.fn(),
      delete: mocks.mockDeleteWhere,
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => mocks.mockSelectRows(),
          }),
        }),
      }),
    },
  };
});

const mockCookieGet = mocks.mockCookieGet;
const mockCookieSet = mocks.mockCookieSet;
const mockDeleteWhere = mocks.mockDeleteWhere;
const mockInsert = mocks.mockInsert;
const mockRedirect = mocks.mockRedirect;
const mockSelectRows = mocks.mockSelectRows;
const mockJson = mocks.mockJson;
const mockCsrf = mocks.mockCsrf;

import { GET, POST } from "@/app/logout/route";

const POST_REQUEST = new Request("http://localhost/logout", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  capturedAuditValues.length = 0;
  mockCsrf.mockResolvedValue(true);
  mockRedirect.mockReturnValue({ redirected: true });
  mockJson.mockImplementation(
    (
      body: unknown,
      init?: { status?: number },
    ): { status?: number; body: unknown } => ({
      status: init?.status,
      body,
    }),
  );
  mockInsert.mockImplementation(() => ({
    values: async (values: Record<string, unknown>) => {
      capturedAuditValues.push(values);
      return [];
    },
  }));
  mockDeleteWhere.mockImplementation(() => ({
    where: () => Promise.resolve(),
  }));
});

describe("logout route POST", () => {
  it("revokes the session, records LOGOUT, clears the cookie, and redirects to /login for a trusted request", async () => {
    mockCookieGet.mockReturnValue({ name: "session", value: "raw-token-123" });
    mockSelectRows.mockResolvedValue([{ id: "s-1", userId: "u-1" }]);

    const response: unknown = await POST(POST_REQUEST);
    expect(response).toEqual({ redirected: true });

    expect(mockDeleteWhere).toHaveBeenCalled();

    const logoutEvent = capturedAuditValues.find(
      (v) => v.action === "LOGOUT",
    );
    expect(logoutEvent).toBeTruthy();
    expect(logoutEvent!.actorUserId).toBe("u-1");
    expect(JSON.stringify(capturedAuditValues)).not.toContain("raw-token-123");

    expect(mockCookieSet).toHaveBeenCalledWith(
      "session",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/login" }),
    );
  });

  it("rejects a cross-origin POST without revoking the session or writing a LOGOUT audit", async () => {
    mockCsrf.mockRejectedValueOnce(new mocks.mockCsrfError());
    mockCookieGet.mockReturnValue({ name: "session", value: "raw-token-123" });

    const response = await POST(POST_REQUEST);

    expect(response.status).toBe(403);
    expect(mockDeleteWhere).not.toHaveBeenCalled();
    expect(capturedAuditValues).toHaveLength(0);
    expect(mockCookieSet).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("rejects a POST with a missing origin without any session mutation", async () => {
    mockCsrf.mockRejectedValueOnce(new mocks.mockCsrfError());
    mockCookieGet.mockReturnValue({ name: "session", value: "raw-token-123" });

    const response = await POST(POST_REQUEST);

    expect(response.status).toBe(403);
    expect(mockDeleteWhere).not.toHaveBeenCalled();
    expect(capturedAuditValues).toHaveLength(0);
    expect(mockCookieSet).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("is a safe no-op that still clears a stale cookie when already logged out", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockSelectRows.mockResolvedValue([]);

    const response: unknown = await POST(POST_REQUEST);
    expect(response).toEqual({ redirected: true });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
    expect(mockCookieSet).toHaveBeenCalledWith(
      "session",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});

describe("logout route GET", () => {
  it("returns 405 Method Not Allowed without revoking the session or auditing", async () => {
    mockCookieGet.mockReturnValue({ name: "session", value: "raw-token-123" });

    const response = await GET();

    expect(response.status).toBe(405);
    expect(mockDeleteWhere).not.toHaveBeenCalled();
    expect(capturedAuditValues).toHaveLength(0);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
