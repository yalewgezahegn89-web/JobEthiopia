import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockAction: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("./actions", () => ({
  employerOnboardingAction: (...args: unknown[]) => mocks.mockAction(...args),
}));

import EmployerRegisterPage from "../page";
import EmployerRegisterForm from "../employer-register-form";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockAction.mockResolvedValue({ error: null });
});

describe("EmployerRegisterPage", () => {
  it("is public and renders without requiring an authenticated user", async () => {
    const element = await EmployerRegisterPage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Request an employer account");
    expect(html).toContain("review it before your organization is activated");
    expect(html).toContain("Already have an account? Sign in");
  });

  it("links to the sign-in and home pages", async () => {
    const element = await EmployerRegisterPage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/"');
  });
});

describe("EmployerRegisterForm", () => {
  it("renders the required credential and organization fields", async () => {
    const html = renderToStaticMarkup(createElement(EmployerRegisterForm));
    for (const label of [
      "Full name",
      "Email",
      "Password",
      "Confirm password",
      "Organization name",
      "Organization slug",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('name="name"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('name="confirmPassword"');
    expect(html).toContain('name="organizationName"');
    expect(html).toContain('name="organizationSlug"');
  });

  it("uses password inputs with new-password autocomplete", async () => {
    const html = renderToStaticMarkup(createElement(EmployerRegisterForm));
    const matches = html.match(/autoComplete="new-password"/g) ?? [];
    expect(matches.length).toBe(2);
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('autoComplete="name"');
  });

  it("exposes no role, profile, or privileged fields", async () => {
    const html = renderToStaticMarkup(createElement(EmployerRegisterForm));
    expect(html).not.toContain('name="role"');
    expect(html).not.toContain('name="userId"');
    expect(html).not.toContain('name="status"');
    expect(html).not.toContain('name="organizationId"');
    expect(html).not.toContain('name="isActive"');
    expect(html).not.toContain('name="isVerified"');
    expect(html).not.toContain('name="reviewedBy"');
    expect(html).not.toContain('name="reviewedAt"');
    expect(html).not.toContain('name="resume"');
  });

  it("provides a submit button for the request", async () => {
    const html = renderToStaticMarkup(createElement(EmployerRegisterForm));
    expect(html).toContain("Submit employer request");
    expect(html).toContain('type="submit"');
  });

  it("renders no errors on the initial clean state", async () => {
    const html = renderToStaticMarkup(createElement(EmployerRegisterForm));
    expect(html).not.toContain('role="alert"');
  });
});
