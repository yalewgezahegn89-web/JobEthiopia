import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockCsrf: vi.fn(),
  mockCreateSource: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: () => mocks.mockCsrf(),
  CsrfError: class CsrfError extends Error {},
}));

vi.mock("@/lib/admin/sources", () => ({
  createSource: (...args: unknown[]) => mocks.mockCreateSource(...args),
}));

import AdminSourceCreatePage from "@/app/admin/sources/create/page";
import CreateSourceForm from "@/app/admin/sources/create/create-source-form";
import { createSourceAction } from "@/app/admin/sources/actions";

const VALID_ID = "11111111-1111-4111-8111-111111111111";

function collectNodes(node: unknown): unknown[] {
  const out: unknown[] = [];
  const walk = (n: unknown): void => {
    if (n === null || n === undefined) return;
    if (typeof n === "string" || typeof n === "number" || typeof n === "boolean") return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (typeof n === "object") {
      const asRecord = n as { type?: unknown; props?: { children?: unknown } };
      out.push(asRecord.type);
      walk(asRecord.props?.children);
    }
  };
  walk(node);
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "u1", email: "a@b.com", name: "A", role: "MODERATOR" },
  });
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockCreateSource.mockResolvedValue({ ok: true, id: VALID_ID });
});

describe("AdminSourceCreatePage", () => {
  it("renders the create page for authenticated staff admin", async () => {
    const element = await AdminSourceCreatePage();
    expect(element).toBeTruthy();
    expect((element as { type: unknown }).type).toBe("div");
    expect(mocks.mockGuard).toHaveBeenCalled();
  });

  it("includes the create source form component", async () => {
    const element = await AdminSourceCreatePage();
    expect(collectNodes(element)).toContain(CreateSourceForm);
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(AdminSourceCreatePage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin (403 semantics)", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(AdminSourceCreatePage()).rejects.toThrow("REDIRECT:/admin");
  });
});

describe("CreateSourceForm", () => {
  it("renders the source creation form", () => {
    const html = renderToStaticMarkup(createElement(CreateSourceForm));
    expect(html).toContain('id="name"');
    expect(html).toContain('id="sourceType"');
    expect(html).toContain('id="baseUrl"');
    expect(html).toContain('id="trustLevel"');
    expect(html).toContain("Create source");
  });

  it("includes all supported source type options", () => {
    const html = renderToStaticMarkup(createElement(CreateSourceForm));
    for (const value of ["MANUAL", "WEBSITE", "API", "FEED", "EMPLOYER", "OTHER"]) {
      expect(html).toContain(`value="${value}"`);
    }
  });

  it("includes all supported trust level options", () => {
    const html = renderToStaticMarkup(createElement(CreateSourceForm));
    for (const value of ["HIGH", "MEDIUM", "LOW"]) {
      expect(html).toContain(`value="${value}"`);
    }
  });

  it("does not invent unsupported source fields", () => {
    const html = renderToStaticMarkup(createElement(CreateSourceForm));
    expect(html).not.toContain("checkFrequencyMinutes");
  });
});

describe("createSourceAction wiring", () => {
  it("createSourceAction is usable by the create page form", async () => {
    const fd = new FormData();
    fd.set("name", "Test Source");
    fd.set("sourceType", "WEBSITE");
    fd.set("baseUrl", "https://example.com");

    const result = await createSourceAction({ ok: false }, fd);

    expect(result.ok).toBe(true);
    expect(mocks.mockCreateSource).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test Source",
        sourceType: "WEBSITE",
        baseUrl: "https://example.com",
      }),
      "u1",
    );
  });
});