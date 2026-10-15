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
  });

  it("points to the correct sitemap URL", () => {
    const config = robots();
    expect(config.sitemap).toBe("https://jobethiopia.com/sitemap.xml");
  });
});