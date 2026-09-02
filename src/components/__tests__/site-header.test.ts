import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockPathname: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: () => mocks.mockGetCurrentUser(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => createElement("a", props as Record<string, unknown>, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.mockPathname(),
}));

import SiteHeader from "@/components/site-header";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};
const ORG_ADMIN = { ...CANDIDATE, id: "22222222-2222-4222-8222-222222222222", role: "ORGANIZATION_ADMIN" };
const STAFF = { ...CANDIDATE, id: "33333333-3333-4333-8333-333333333333", role: "ADMIN" };

async function renderHeader(): Promise<string> {
  const element = await SiteHeader();
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue(null);
  mocks.mockPathname.mockReturnValue("/");
});

describe("SiteHeader", () => {
  it("guest sees public navigation and Login", async () => {
    const html = await renderHeader();
    for (const label of [
      "Home",
      "Jobs",
      "Organizations",
      "Categories",
      "Professions",
      "Locations",
      "Careers",
      "Sign up",
      "Login",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("Logout");
    expect(html).not.toContain("My Applications");
    expect(html).not.toContain("/admin");
    expect(html).toContain('href="/register"');
    expect(html).toContain("For Employers");
    expect(html).toContain('href="/employer/register"');
  });

  it("candidate sees public navigation plus candidate links and Logout", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
    const html = await renderHeader();
    expect(html).toContain("Jobs");
    for (const label of ["My Applications", "Saved Jobs", "Profile", "Logout"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("Login");
    expect(html).not.toContain("Sign up");
  });

  it("organization admin sees employer links and Logout", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(ORG_ADMIN);
    const html = await renderHeader();
    for (const label of [
      "Organization",
      "Jobs",
      "Applications",
      "Team",
      "Logout",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("Login");
    expect(html).not.toContain("My Applications");
    expect(html).not.toContain("Sign up");
  });

  it("staff sees Admin and Logout", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(STAFF);
    const html = await renderHeader();
    expect(html).toContain("Admin");
    expect(html).toContain("Logout");
    expect(html).not.toContain("My Applications");
    expect(html).not.toContain('href="/organization"');
    expect(html).not.toContain("Login");
    expect(html).not.toContain("Sign up");
  });

  it("role-specific links do not leak across roles", async () => {
    // candidate must not see employer org links
    mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
    const candidateHtml = await renderHeader();
    expect(candidateHtml).not.toContain('href="/organization"');
    expect(candidateHtml).not.toContain("Admin");
    expect(candidateHtml).not.toContain("For Employers");

    // admin must not see candidate/employer links
    mocks.mockGetCurrentUser.mockResolvedValue(STAFF);
    const staffHtml = await renderHeader();
    expect(staffHtml).not.toContain("My Applications");
    expect(staffHtml).not.toContain("Saved Jobs");
    expect(staffHtml).not.toContain("/organization/team");

    // employer must not see candidate links
    mocks.mockGetCurrentUser.mockResolvedValue(ORG_ADMIN);
    const orgHtml = await renderHeader();
    expect(orgHtml).not.toContain("My Applications");
    expect(orgHtml).not.toContain("/admin");
  });

  it("navigation destinations are correct", async () => {
    const html = await renderHeader();
    for (const href of [
      "/",
      "/jobs",
      "/organizations",
      "/categories",
      "/professions",
      "/locations",
      "/careers",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("logout points to the existing logout route", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
    const html = await renderHeader();
    expect(html).toContain('action="/logout"');
    expect(html).toContain("POST");
  });

  it("marks the active public link with aria-current", async () => {
    mocks.mockPathname.mockReturnValue("/jobs");
    const html = await renderHeader();
    expect(html).toContain('aria-current="page"');
  });

  it("renders the mobile menu button with accessible attributes", async () => {
    const html = await renderHeader();
    expect(html).toContain('aria-controls="mobile-menu"');
    expect(html).toContain('aria-label="Open menu"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("does not render the mobile menu panel when closed", async () => {
    const html = await renderHeader();
    expect(html).not.toContain("mobile-menu-panel");
    expect(html).not.toContain('aria-modal="true"');
  });
});
