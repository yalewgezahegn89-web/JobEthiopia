import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement as h, createElement, type ReactNode } from "react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: () => ({ status: 200 }), redirect: () => ({}) },
}));

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockSessionsFindFirst: vi.fn(),
  mockUsersFindFirst: vi.fn(),
  mockUpdateSet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mocks.mockCookieGet,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
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

import AdminLayout from "@/app/admin/layout";

const mockCookieGet = mocks.mockCookieGet;
const mockSessionsFindFirst = mocks.mockSessionsFindFirst;
const mockUsersFindFirst = mocks.mockUsersFindFirst;
const mockUpdateSet = mocks.mockUpdateSet;

const SESSION_ROW = {
  id: "s-1",
  userId: "u-1",
  tokenHash: "hhh",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60),
};

function staffUser(role: string) {
  return {
    id: "u-1",
    email: "admin@example.com",
    name: "Admin User",
    role,
    isActive: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateSet.mockImplementation(() => ({
    set: () => ({ where: () => Promise.resolve() }),
  }));
});

describe("admin layout protection", () => {
  it("redirects unauthenticated users to /login", async () => {
    mockCookieGet.mockReturnValue(undefined);

    await expect(
      AdminLayout({ children: createElement("div", null, "children") }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects to /login when the session is invalid", async () => {
    mockCookieGet.mockReturnValue({ name: "session", value: "bad-token" });
    mockSessionsFindFirst.mockResolvedValue(null);

    await expect(
      AdminLayout({ children: createElement("div", null, "children") }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("renders children for a SUPER_ADMIN", async () => {
    mockCookieGet.mockReturnValue({ name: "session", value: "ok-token" });
    mockSessionsFindFirst.mockResolvedValue(SESSION_ROW);
    mockUsersFindFirst.mockResolvedValue(staffUser("SUPER_ADMIN"));

    const children = h("div", null, "admin children");
    const element = await AdminLayout({ children });
    expect((element.props as { children: unknown }).children).toBe(children);
  });

  it("renders children for an ADMIN", async () => {
    mockCookieGet.mockReturnValue({ name: "session", value: "ok-token" });
    mockSessionsFindFirst.mockResolvedValue(SESSION_ROW);
    mockUsersFindFirst.mockResolvedValue(staffUser("ADMIN"));

    const children = h("div", null, "admin children");
    const element = await AdminLayout({ children });
    expect((element.props as { children: unknown }).children).toBe(children);
  });

  it("renders children for a MODERATOR", async () => {
    mockCookieGet.mockReturnValue({ name: "session", value: "ok-token" });
    mockSessionsFindFirst.mockResolvedValue(SESSION_ROW);
    mockUsersFindFirst.mockResolvedValue(staffUser("MODERATOR"));

    const children = h("div", null, "admin children");
    const element = await AdminLayout({ children });
    expect((element.props as { children: unknown }).children).toBe(children);
  });

  it("renders a forbidden screen instead of children for a CANDIDATE", async () => {
    mockCookieGet.mockReturnValue({ name: "session", value: "ok-token" });
    mockSessionsFindFirst.mockResolvedValue(SESSION_ROW);
    mockUsersFindFirst.mockResolvedValue(staffUser("CANDIDATE"));

    const children = h("div", null, "admin children");
    const element = await AdminLayout({ children });
    expect(element.type).toBe("section");
    expect((element.props as { children: unknown }).children).not.toBe(children);
  });

  it("renders a forbidden screen instead of children for ORGANIZATION_ADMIN", async () => {
    mockCookieGet.mockReturnValue({ name: "session", value: "ok-token" });
    mockSessionsFindFirst.mockResolvedValue(SESSION_ROW);
    mockUsersFindFirst.mockResolvedValue(staffUser("ORGANIZATION_ADMIN"));

    const children = h("div", null, "admin children");
    const element = await AdminLayout({ children });
    expect(element.type).toBe("section");
  });
});