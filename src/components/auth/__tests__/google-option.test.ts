import { describe, it, expect } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GoogleOption } from "@/components/auth/google-option";
import { I18nProvider } from "@/lib/i18n/client";
import { dictionaries } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

function render(
  locale: Locale,
  props: Partial<ComponentProps<typeof GoogleOption>> = {},
) {
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop -- I18nProvider requires an explicit children prop in createElement
    createElement(I18nProvider, {
      locale,
      children: createElement(GoogleOption, {
        configured: true,
        ...props,
      }),
    }),
  );
}

describe("GoogleOption", () => {
  it("renders a Google sign-in link when configured", () => {
    const html = render("en");
    expect(html).toContain("Continue with Google");
    expect(html).toContain('href="/api/auth/google/start?locale=en"');
    expect(html).toContain("Sign in securely with your Google account.");
  });

  it("hides the option when Google credentials are not configured", () => {
    const html = render("en", { configured: false });
    expect(html).toBe("");
  });

  it("shows a localized error when returning from a failed attempt", () => {
    const html = render("en", { configured: false, showError: true });
    expect(html).toContain(dictionaries.en.googleAuth.error);
    expect(html).toContain('role="alert"');
  });

  it("shows a localized account-conflict message", () => {
    const html = render("en", {
      configured: false,
      showConflict: true,
    });
    expect(html).toContain(dictionaries.en.googleAuth.conflict);
    expect(html).toContain('role="alert"');
  });

  it("renders English, Amharic, and Afaan Oromoo copy", () => {
    for (const locale of ["en", "am", "om"] as const) {
      const html = render(locale);
      expect(html).toContain(dictionaries[locale].googleAuth.button);
      expect(html).toContain(dictionaries[locale].googleAuth.hint);
      expect(html).toContain(dictionaries[locale].googleAuth.divider);
      expect(html).toContain(`/api/auth/google/start?locale=${locale}`);
    }
  });

  it("does not embed the Google client secret in markup", () => {
    const previous = process.env.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_CLIENT_SECRET = "super-secret-value";
    try {
      const html = render("en");
      expect(html).not.toContain("super-secret-value");
    } finally {
      if (previous === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = previous;
    }
  });
});
