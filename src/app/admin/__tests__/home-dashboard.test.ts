import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: () =>
    Promise.resolve({ name: "Admin User", role: "SUPER_ADMIN" }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/components/ui/brand-mark", () => ({
  BrandMark: () => createElement("svg", { "data-testid": "brand" }),
}));

import AdminHomePage from "../page";

async function renderHome(): Promise<string> {
  const element = await AdminHomePage();
  return renderToStaticMarkup(element);
}

describe("Admin home dashboard", () => {
  it("renders exactly one admin navigation and the signed-in identity", async () => {
    const html = await renderHome();
    const navs = (html.match(/aria-label="Admin workspace"/g) ?? []).length;
    expect(navs).toBe(1);
    expect(html).toContain("Admin User");
    expect(html).toContain("SUPER_ADMIN");
    expect(html).toContain("Logout");
  });

  it("surfaces all operational workspaces as links", async () => {
    const html = await renderHome();
    expect(html).toContain("Job Moderation");
    expect(html).toContain("Organizations");
    expect(html).toContain("Employer Requests");
    expect(html).toContain("Sources");
    expect(html).toContain("Users");
    expect(html).toContain("Taxonomy");
    expect(html).toContain("Audit Log");
    expect(html).toContain("Operations");
    expect(html).toContain('href="/admin/jobs"');
    expect(html).toContain('href="/admin/audit"');
    expect(html).toContain('href="/admin/operations"');
  });
});
