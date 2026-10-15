import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockPathname: vi.fn(),
}));

vi.mock("@/lib/i18n/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n/client")>();
  return {
    ...actual,
    useI18n: () => ({ locale: "en" as const, t: dictionaries.en }),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.mockPathname(),
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

import { dictionaries } from "@/lib/i18n/dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";

function renderSwitcher(): string {
  return renderToStaticMarkup(createElement(LanguageSwitcher));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockPathname.mockReturnValue("/jobs");
});

describe("LanguageSwitcher", () => {
  it("renders language options for en, am, and om", () => {
    const html = renderSwitcher();
    expect(html).toContain("English");
    expect(html).toContain("አማርኛ");
    expect(html).toContain("Afaan Oromoo");
  });

  it("marks the current locale (en) with aria-current", () => {
    const html = renderSwitcher();
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('aria-label="English (en)"');
  });

  it("does not mark non-current locales with aria-current", () => {
    const html = renderSwitcher();
    expect(html).not.toContain('aria-label="Afaan Oromoo (om)" aria-current');
    expect(html).not.toContain('aria-label="አማርኛ (am)" aria-current');
  });

  it("builds correct locale-prefixed hrefs for switching on an unprefixed path", () => {
    mocks.mockPathname.mockReturnValue("/jobs");
    const html = renderSwitcher();
    expect(html).toContain('href="/jobs"');
    expect(html).toContain('href="/am/jobs"');
    expect(html).toContain('href="/om/jobs"');
  });

  it("strips an existing locale prefix when building hrefs", () => {
    mocks.mockPathname.mockReturnValue("/am/jobs");
    const html = renderSwitcher();
    expect(html).toContain('href="/jobs"');
    expect(html).toContain('href="/am/jobs"');
    expect(html).toContain('href="/om/jobs"');
  });

  it("maps the root path to bare locale branches", () => {
    mocks.mockPathname.mockReturnValue("/");
    const html = renderSwitcher();
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/am"');
    expect(html).toContain('href="/om"');
  });
});
