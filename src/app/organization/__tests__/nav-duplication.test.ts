import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const ROOT = join(process.cwd(), "src/app/organization");

vi.mock("next/navigation", () => ({
  usePathname: () => "/organization/jobs",
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
  }) => createElement("a", { href, ...(ariaCurrent ? { "aria-current": ariaCurrent } : {}) }, children),
}));

vi.mock("@/components/ui/brand-mark", () => ({
  BrandMark: () => createElement("svg", { "data-testid": "brand" }),
}));

import { OrganizationNav } from "../nav";

describe("Employer navigation (single surface)", () => {
  it("OrganizationNav renders exactly one employer <nav>", () => {
    const html = renderToString(createElement(OrganizationNav));
    const count = (html.match(/aria-label="Employer workspace"/g) ?? []).length;
    expect(count).toBe(1);
    expect(html).toContain("Dashboard");
    expect(html).toContain("Jobs");
    expect(html).toContain("Applications");
    expect(html).toContain("Team");
  });

  it("only the layout renders OrganizationNav; pages must not self-render it", () => {
    const pages = [
      "page.tsx",
      join("jobs", "page.tsx"),
      join("jobs", "create", "page.tsx"),
      join("jobs", "[id]", "page.tsx"),
      join("jobs", "[id]", "edit", "page.tsx"),
      join("applications", "page.tsx"),
      join("applications", "[id]", "page.tsx"),
      join("team", "page.tsx"),
    ];

    for (const rel of pages) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      const hasNavRender = /\{?\s*<OrganizationNav\s*\/?>/.test(src);
      expect(
        hasNavRender,
        `${rel} must not render OrganizationNav (nav lives only in layout.tsx)`,
      ).toBe(false);
    }
  });

  it("the layout is the sole renderer of OrganizationNav", () => {
    const layoutSource = readFileSync(join(ROOT, "layout.tsx"), "utf8");
    const occurrences =
      (layoutSource.match(/<OrganizationNav\s*\/?>/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("highlights the current route with aria-current for nested paths", () => {
    const html = renderToString(createElement(OrganizationNav));
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("/organization/jobs");
  });
});
