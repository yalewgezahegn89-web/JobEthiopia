import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appBaseUrl", () => ({
  getAppBaseUrl: () => "https://jobethiopia.com",
}));

import robots from "../robots";

import type { MetadataRoute } from "next";

function rule(config: MetadataRoute.Robots) {
  if (Array.isArray(config.rules)) {
    return config.rules[0];
  }
  return config.rules;
}

describe("robots.ts", () => {
  it("allows public routes", () => {
    const config = robots();
    expect(rule(config).allow).toContain("/");
  });

  it("disallows private namespaces", () => {
    const config = robots();
    expect(rule(config).disallow).toContain("/admin/");
    expect(rule(config).disallow).toContain("/organization/");
    expect(rule(config).disallow).toContain("/api/");
    expect(rule(config).disallow).toContain("/employer/");
    expect(rule(config).disallow).toContain("/applications/");
  });

  it("disallows auth and account pages in every locale", () => {
    const disallow = rule(robots()).disallow ?? [];
    for (const path of ["/login", "/am/login", "/om/login", "/settings", "/am/settings", "/om/settings"]) {
      expect(disallow).toContain(path);
    }
  });

  it("does not disallow the public organizations listing", () => {
    const disallow = rule(robots()).disallow;
    const entries = Array.isArray(disallow)
      ? disallow
      : typeof disallow === "string"
        ? [disallow]
        : [];

    expect(entries).toContain("/organization/");
    expect(
      entries.some((entry: string) => entry.startsWith("/organizations")),
    ).toBe(false);
  });

  it("points to the correct sitemap URL", () => {
    const config = robots();
    expect(config.sitemap).toBe("https://jobethiopia.com/sitemap.xml");
  });
});
