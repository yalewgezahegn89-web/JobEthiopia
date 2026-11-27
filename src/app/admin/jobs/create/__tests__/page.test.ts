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

function findNode(node: unknown, type: unknown): { props?: Record<string, unknown> } | undefined {
  if (node === null || node === undefined) return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findNode(child, type);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof node === "object") {
    const asRecord = node as { type?: unknown; props?: { children?: unknown } };
    if (asRecord.type === type) return asRecord;
    return findNode(asRecord.props?.children, type);
  }
  return undefined;
}

function stubOptionData() {
  mocks.mockSelect
    .mockReturnValueOnce(dbChain([{ id: "org-1", name: "ABC Corp" }]))
    .mockReturnValueOnce(dbChain([{ id: "cat-1", name: "Finance" }]))
    .mockReturnValueOnce(dbChain([{ id: "prof-1", name: "Accountant" }]))
    .mockReturnValueOnce(dbChain([{ id: "loc-1", name: "Addis Ababa" }]))
    .mockReturnValueOnce(dbChain([{ name: "UNICEF Careers Website" }]));
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

  it("disables original-source creation for moderators but provides eligible existing sources", async () => {
    stubOptionData();
    const element = await AdminJobsCreatePage();
    const form = findNode(element, JobCreateForm);
    expect(form?.props?.canCreateOriginalSource).toBe(false);
    expect(form?.props?.originalSources).toEqual([
      { name: "UNICEF Careers Website" },
    ]);
  });

  it("enables original-source creation for admins and provides eligible existing sources", async () => {
    mocks.mockGuard.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN" },
    });
    stubOptionData();
    const element = await AdminJobsCreatePage();
    const form = findNode(element, JobCreateForm);
    expect(form?.props?.canCreateOriginalSource).toBe(true);
    expect(form?.props?.originalSources).toEqual([
      { name: "UNICEF Careers Website" },
    ]);
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
  it("loads active organizations, categories, professions, locations, and eligible original sources", async () => {
    stubOptionData();
    await AdminJobsCreatePage();
    expect(mocks.mockSelect).toHaveBeenCalledTimes(5);
  });

  it("renders a safe error and no form when option loading fails", async () => {
    mocks.mockSelect.mockRejectedValue(new Error("db down"));
    const element = await AdminJobsCreatePage();
    expect(element).toBeTruthy();
    expect(collectNodes(element)).not.toContain(JobCreateForm);
  });
});