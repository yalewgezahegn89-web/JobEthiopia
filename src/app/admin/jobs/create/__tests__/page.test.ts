import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.mockSelect(...args),
  },
}));

import AdminJobsCreatePage from "@/app/admin/jobs/create/page";
import JobCreateForm from "@/app/admin/jobs/create/job-create-form";

function dbChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

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

function stubOptionData() {
  mocks.mockSelect
    .mockReturnValueOnce(dbChain([{ id: "org-1", name: "ABC Corp" }]))
    .mockReturnValueOnce(dbChain([{ id: "cat-1", name: "Finance" }]))
    .mockReturnValueOnce(dbChain([{ id: "prof-1", name: "Accountant" }]))
    .mockReturnValueOnce(dbChain([{ id: "loc-1", name: "Addis Ababa" }]));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "u1", email: "a@b.com", name: "A", role: "MODERATOR" },
  });
});

describe("AdminJobsCreatePage — access control", () => {
  it("renders the create page for an authorized staff admin", async () => {
    stubOptionData();
    const element = await AdminJobsCreatePage();
    expect((element as { type: unknown }).type).toBe("div");
    expect(mocks.mockGuard).toHaveBeenCalled();
  });

  it("does not render the form until options load", async () => {
    stubOptionData();
    const element = await AdminJobsCreatePage();
    expect(collectNodes(element)).toContain(JobCreateForm);
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(AdminJobsCreatePage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin/jobs (403 semantics)", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(AdminJobsCreatePage()).rejects.toThrow("REDIRECT:/admin/jobs");
  });
});

describe("AdminJobsCreatePage — selector data loading", () => {
  it("loads active organizations, categories, professions and locations", async () => {
    stubOptionData();
    await AdminJobsCreatePage();
    expect(mocks.mockSelect).toHaveBeenCalledTimes(4);
  });

  it("renders a safe error and no form when option loading fails", async () => {
    mocks.mockSelect.mockRejectedValue(new Error("db down"));
    const element = await AdminJobsCreatePage();
    expect(element).toBeTruthy();
    expect(collectNodes(element)).not.toContain(JobCreateForm);
  });
});