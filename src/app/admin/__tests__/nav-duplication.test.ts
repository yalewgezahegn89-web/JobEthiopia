import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const ROOT = join(process.cwd(), "src/app/admin");

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/jobs",
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    "aria-current": ariaCurrent,
  }: {
    href: string;
    children: ReactNode;
    "aria-current"?: string;
  }) =>
    createElement(
      "a",
      { href, ...(ariaCurrent ? { "aria-current": ariaCurrent } : {}) },
      children,
    ),
}));

vi.mock("@/components/ui/brand-mark", () => ({
  BrandMark: () => createElement("svg", { "data-testid": "brand" }),
}));

import AdminNav from "../nav";

describe("Staff navigation (single surface per page)", () => {
  it("AdminNav renders exactly one admin <nav> with brand, links, and logout", () => {
    const html = renderToString(createElement(AdminNav));
    const count = (html.match(/aria-label="Admin workspace"/g) ?? []).length;
    expect(count).toBe(1);
    expect(html).toContain("data-testid");
    expect(html).toContain("Job Moderation");
    expect(html).toContain("Audit Log");
    expect(html).toContain("Logout");
  });

  it("marks the active route with aria-current", () => {
    const html = renderToString(createElement(AdminNav));
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("/admin/jobs");
  });

  it("the admin layout does NOT render AdminNav (per-page ownership preserved for structural tests)", () => {
    const layoutSource = readFileSync(join(ROOT, "layout.tsx"), "utf8");
    const occurrences =
      (layoutSource.match(/<AdminNav\s*\/?>/g) ?? []).length;
    expect(occurrences).toBe(0);
  });
});
