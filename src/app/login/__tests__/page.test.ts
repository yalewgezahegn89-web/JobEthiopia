import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockLoginAction: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("./actions", () => ({
  loginAction: (...args: unknown[]) => mocks.mockLoginAction(...args),
}));

vi.mock("@/components/auth/telegram-option", () => ({
  TelegramOption: () => createElement("div", null, "telegram-option"),
}));

vi.mock("@/components/auth/google-option", () => ({
  GoogleOption: () => createElement("div", null, "google-option"),
}));

import LoginPage from "../page";
import LoginForm from "../login-form";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockLoginAction.mockResolvedValue({ error: null });
});

describe("LoginPage", () => {
  it("is public and renders without requiring an authenticated user", async () => {
    const element = await LoginPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Sign in to JobEthiopia");
    expect(html).toContain("Create an account");
    expect(html).toContain("Back to JobEthiopia");
  });

  it("links to the register and home pages", async () => {
    const element = await LoginPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('href="/register"');
    expect(html).toContain('href="/"');
  });

  it("retains email/password, Google, and Telegram options", async () => {
    const element = await LoginPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain("google-option");
    expect(html).toContain("telegram-option");
  });
});

describe("LoginForm", () => {
  it("renders the required fields and labels", async () => {
    const html = renderToStaticMarkup(createElement(LoginForm));
    for (const label of ["Email", "Password"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
  });

  it("uses password inputs with current-password autocomplete", async () => {
    const html = renderToStaticMarkup(createElement(LoginForm));
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('autoComplete="email"');
  });

  it("provides a Sign in submit button", async () => {
    const html = renderToStaticMarkup(createElement(LoginForm));
    expect(html).toContain("Sign in");
    expect(html).toContain('type="submit"');
  });

  it("renders no errors on the initial clean state", async () => {
    const html = renderToStaticMarkup(createElement(LoginForm));
    expect(html).not.toContain('role="alert"');
  });
});
