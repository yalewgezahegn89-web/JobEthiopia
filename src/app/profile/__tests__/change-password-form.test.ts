import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { en } from "@/lib/i18n/messages/en";

vi.mock("../change-password/actions", () => ({
  changePasswordAction: vi.fn(),
}));

import ChangePasswordForm from "../change-password/change-password-form";

const t = en as Dictionary;

describe("ChangePasswordForm", () => {
  it("renders the current password field with label and autocomplete", async () => {
    const html = renderToStaticMarkup(createElement(ChangePasswordForm, { t }));
    expect(html).toContain("Current password");
    expect(html).toContain('name="currentPassword"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('type="password"');
  });

  it("renders the new password field with label and autocomplete", async () => {
    const html = renderToStaticMarkup(createElement(ChangePasswordForm, { t }));
    expect(html).toContain("New password");
    expect(html).toContain('name="newPassword"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('type="password"');
  });

  it("renders the confirm new password field with label and autocomplete", async () => {
    const html = renderToStaticMarkup(createElement(ChangePasswordForm, { t }));
    expect(html).toContain("Confirm new password");
    expect(html).toContain('name="confirmPassword"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('type="password"');
  });

  it("renders all three password-type inputs", async () => {
    const html = renderToStaticMarkup(createElement(ChangePasswordForm, { t }));
    const typeCount = (html.match(/type="password"/g) ?? []).length;
    expect(typeCount).toBe(3);
  });

  it("renders a submit button", async () => {
    const html = renderToStaticMarkup(createElement(ChangePasswordForm, { t }));
    expect(html).toContain('type="submit"');
    expect(html).toContain("Change password");
  });

  it("shows 8-character minimum hint", async () => {
    const html = renderToStaticMarkup(createElement(ChangePasswordForm, { t }));
    expect(html).toContain("8 characters");
  });

  it("does not render errors in the initial state", async () => {
    const html = renderToStaticMarkup(createElement(ChangePasswordForm, { t }));
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it("renders a form-level error with role=alert", async () => {
    const html = renderToStaticMarkup(
      createElement(ChangePasswordForm, {
        t,
        initialState: { formError: "Your current password is incorrect." },
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Your current password is incorrect.");
  });

  it("renders a per-field error with aria-describedby", async () => {
    const html = renderToStaticMarkup(
      createElement(ChangePasswordForm, {
        t,
        initialState: {
          fieldErrors: {
            newPassword: "New password must be at least 8 characters.",
          },
        },
      }),
    );
    expect(html).toContain('aria-describedby="newPassword-error"');
    expect(html).toContain('id="newPassword-error"');
    expect(html).toContain('role="alert"');
  });

  it("renders success with role=status", async () => {
    const html = renderToStaticMarkup(
      createElement(ChangePasswordForm, {
        t,
        initialState: { success: "Your password has been changed." },
      }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Your password has been changed.");
  });

  it("exposes no role, organization, or profile fields", async () => {
    const html = renderToStaticMarkup(createElement(ChangePasswordForm, { t }));
    expect(html).not.toContain('name="role"');
    expect(html).not.toContain('name="organizationId"');
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain('name="phone"');
    expect(html).not.toContain('name="education"');
    expect(html).not.toContain('name="isActive"');
    expect(html).not.toContain('name="passwordHash"');
  });

  it("does not render any password value in the initial output", async () => {
    const html = renderToStaticMarkup(createElement(ChangePasswordForm, { t }));
    expect(html).not.toContain("OldPassword");
    expect(html).not.toContain("NewPassword");
  });
});
