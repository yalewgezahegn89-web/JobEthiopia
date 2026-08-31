import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockRegisterAction: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("./actions", () => ({
  registerAction: (...args: unknown[]) => mocks.mockRegisterAction(...args),
}));

import RegisterPage from "../page";
import RegisterForm from "../register-form";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockRegisterAction.mockResolvedValue({ error: null });
});

describe("RegisterPage", () => {
  it("is public and renders without requiring an authenticated user", async () => {
    const element = await RegisterPage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Create your account");
    expect(html).toContain("Already have an account? Sign in");
    expect(html).toContain("Back to JobEthiopia");
  });

  it("links to the sign-in and home pages", async () => {
    const element = await RegisterPage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/"');
  });
});

describe("RegisterForm", () => {
  it("renders the required fields and labels", async () => {
    const html = renderToStaticMarkup(createElement(RegisterForm));
    for (const label of ["Full name", "Email", "Password", "Confirm password"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('name="name"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('name="confirmPassword"');
  });

  it("uses password inputs with new-password autocomplete", async () => {
    const html = renderToStaticMarkup(createElement(RegisterForm));
    const matches = html.match(/autoComplete="new-password"/g) ?? [];
    expect(matches.length).toBe(2);
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('autoComplete="name"');
  });

  it("exposes no role, organization, or profile fields", async () => {
    const html = renderToStaticMarkup(createElement(RegisterForm));
    expect(html).not.toContain('name="role"');
    expect(html).not.toContain('name="organizationId"');
    expect(html).not.toContain('name="phone"');
    expect(html).not.toContain('name="education"');
    expect(html).not.toContain('name="resume"');
    expect(html).not.toContain('name="isActive"');
  });

  it("provides a Register submit button", async () => {
    const html = renderToStaticMarkup(createElement(RegisterForm));
    expect(html).toContain("Register");
    expect(html).toContain('type="submit"');
  });

  it("renders no errors on the initial clean state", async () => {
    const html = renderToStaticMarkup(createElement(RegisterForm));
    expect(html).not.toContain('role="alert"');
  });
});
