import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockCookieSet: vi.fn(),
  mockCookieDelete: vi.fn(),
  mockSelectRows: vi.fn(),
  mockDeleteWhere: vi.fn(),
  mockInsert: vi.fn(),
  mockRedirect: vi.fn(),
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
  },
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

import { GET } from "@/app/logout/route";

const REQUEST = new Request("http://localhost/logout", { method: "GET" });

beforeEach(() => {
  vi.clearAllMocks();
  capturedAuditValues.length = 0;
  mockRedirect.mockReturnValue({ redirected: true });
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

describe("logout route", () => {
  it("revokes the session, records LOGOUT, clears the cookie, and redirects to /login", async () => {
    mockCookieGet.mockReturnValue({ name: "session", value: "raw-token-123" });
    mockSelectRows.mockResolvedValue([
      { id: "s-1", userId: "u-1" },
    ]);

    const response = await GET(REQUEST);
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

  it("clears the cookie and redirects even when already logged out", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockSelectRows.mockResolvedValue([]);

    const response = await GET(REQUEST);
    expect(response).toEqual({ redirected: true });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
    expect(mockCookieSet).toHaveBeenCalledWith(
      "session",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});