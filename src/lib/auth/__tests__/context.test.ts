import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}));

const mocks = vi.hoisted(() => ({
  mockSessionsFindFirst: vi.fn(),
  mockUsersFindFirst: vi.fn(),
  mockUpdateSet: vi.fn(),
}));

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        sessions: {
          findFirst: (...args: unknown[]) => mocks.mockSessionsFindFirst(...args),
        },
        users: {
          findFirst: (...args: unknown[]) => mocks.mockUsersFindFirst(...args),
        },
      },
      insert: vi.fn(),
      update: mocks.mockUpdateSet,
      delete: vi.fn(),
      select: vi.fn(),
    },
  };
});

const mockSessionsFindFirst = mocks.mockSessionsFindFirst;
const mockUsersFindFirst = mocks.mockUsersFindFirst;
const mockUpdateSet = mocks.mockUpdateSet;

import {
  requireRole,
  requireAnyRole,
  parseCookie,
} from "../context";

const SESSION_ROW = {
  id: "s-1",
  userId: "u-1",
  tokenHash: "hhh",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60),
};

function authedRequest(role: string, token = "raw-token"): Request {
  return new Request("http://localhost/api/x", {
    headers: { cookie: `session=${token}` },
  });
}

function anonRequest(): Request {
  return new Request("http://localhost/api/x");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateSet.mockImplementation(() => ({
    set: () => ({ where: () => Promise.resolve() }),
  }));
  mockSessionsFindFirst.mockResolvedValue(SESSION_ROW);
  mockUsersFindFirst.mockResolvedValue({
    id: "u-1",
    email: "admin@example.com",
    name: "Admin",
    role: "CANDIDATE",
  });
});

describe("context / role guards", () => {
  it("parseCookie extracts a cookie value", () => {
    expect(parseCookie("a=1; session=tok123; b=2", "session")).toBe("tok123");
  });

  it("parseCookie handles values that contain = characters", () => {
    expect(parseCookie("session=ab=cd", "session")).toBe("ab=cd");
  });

  it("parseCookie returns null when the cookie is absent", () => {
    expect(parseCookie("other=1", "session")).toBeNull();
    expect(parseCookie("", "session")).toBeNull();
  });

  it("requireRole returns 401 for unauthenticated requests", async () => {
    const guard = await requireRole(anonRequest(), "ADMIN");
    if ("response" in guard) {
      expect(guard.response.status).toBe(401);
    } else {
      throw new Error("expected 401");
    }
  });

  it("requireRole returns 403 when the role is insufficient", async () => {
    mockUsersFindFirst.mockResolvedValue({
      id: "u-1",
      email: "m@example.com",
      name: "Moderator",
      role: "MODERATOR",
      isActive: true,
    });
    const guard = await requireRole(authedRequest("MODERATOR"), "ADMIN");
    if ("response" in guard) {
      expect(guard.response.status).toBe(403);
    } else {
      throw new Error("expected 403");
    }
  });

  it("requireRole allows the exact role", async () => {
    mockUsersFindFirst.mockResolvedValue({
      id: "u-1",
      email: "a@example.com",
      name: "Admin",
      role: "ADMIN",
      isActive: true,
    });
    const guard = await requireRole(authedRequest("ADMIN"), "ADMIN");
    if ("user" in guard) {
      expect(guard.user.role).toBe("ADMIN");
    } else {
      throw new Error("expected success");
    }
  });

  it("requireRole denies SUPER_ADMIN on an ADMIN endpoint (exact match / least privilege)", async () => {
    mockUsersFindFirst.mockResolvedValue({
      id: "u-1",
      email: "s@example.com",
      name: "Super",
      role: "SUPER_ADMIN",
      isActive: true,
    });
    const guard = await requireRole(authedRequest("SUPER_ADMIN"), "ADMIN");
    if ("response" in guard) {
      expect(guard.response.status).toBe(403);
    } else {
      throw new Error("expected 403");
    }
  });

  it("requireAnyRole rejects unauthenticated requests with 401", async () => {
    const guard = await requireAnyRole(anonRequest(), ["ADMIN", "MODERATOR"]);
    if ("response" in guard) {
      expect(guard.response.status).toBe(401);
    } else {
      throw new Error("expected 401");
    }
  });

  it("requireAnyRole allows any listed role", async () => {
    mockUsersFindFirst.mockResolvedValue({
      id: "u-1",
      email: "m@example.com",
      name: "Moderator",
      role: "MODERATOR",
      isActive: true,
    });
    const guard = await requireAnyRole(authedRequest("MODERATOR"), [
      "ADMIN",
      "MODERATOR",
    ]);
    if ("user" in guard) {
      expect(guard.user.role).toBe("MODERATOR");
    } else {
      throw new Error("expected success");
    }
  });

  it("requireAnyRole returns 403 for banned roles", async () => {
    mockUsersFindFirst.mockResolvedValue({
      id: "u-1",
      email: "c@example.com",
      name: "Candidate",
      role: "CANDIDATE",
      isActive: true,
    });
    const guard = await requireAnyRole(authedRequest("CANDIDATE"), [
      "ADMIN",
      "MODERATOR",
    ]);
    if ("response" in guard) {
      expect(guard.response.status).toBe(403);
    } else {
      throw new Error("expected 403");
    }
  });
});