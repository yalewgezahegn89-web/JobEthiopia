import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries } from "@/lib/i18n/dictionary";
import { I18nProvider } from "@/lib/i18n/client";

const mocks = vi.hoisted(() => ({
  mockGetCurrentLocale: vi.fn(),
  mockGetI18n: vi.fn(),
}));

vi.mock("@/lib/i18n/server", () => ({
  getCurrentLocale: () => mocks.mockGetCurrentLocale(),
  getI18n: () => mocks.mockGetI18n(),
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

import SiteFooter from "@/components/site-footer";

async function renderFooter(locale: "en" | "am" | "om" = "en") {
  mocks.mockGetCurrentLocale.mockResolvedValue(locale);
  mocks.mockGetI18n.mockResolvedValue(dictionaries[locale]);
  const element = await SiteFooter();
  const Provider = I18nProvider as ComponentType<{
    locale: "en" | "am" | "om";
    children?: ReactNode;
  }>;
  return renderToStaticMarkup(createElement(Provider, { locale }, element));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SiteFooter social links", () => {
  it("renders Facebook and Telegram links with correct destinations and attributes", async () => {
    const html = await renderFooter("en");

    expect(html).toContain('href="https://www.facebook.com/JobEthiopiaET"');
    expect(html).toContain('href="https://t.me/jobethiopiaet"');
    expect(html).toContain("Follow JobEthiopia on Facebook");
    expect(html).toContain("Join our Telegram channel");

    const anchors = html.match(/<a [^>]*>/g) ?? [];
    const facebookAnchor =
      anchors.find((a) => a.includes("facebook.com/JobEthiopiaET")) ?? "";
    const telegramAnchor =
      anchors.find((a) => a.includes("t.me/jobethiopiaet")) ?? "";

    expect(facebookAnchor).toContain('target="_blank"');
    expect(facebookAnchor).toContain('rel="noopener noreferrer"');
    expect(facebookAnchor).toContain('aria-label="Follow JobEthiopia on Facebook"');
    expect(telegramAnchor).toContain('target="_blank"');
    expect(telegramAnchor).toContain('rel="noopener noreferrer"');
    expect(telegramAnchor).toContain('aria-label="Join our Telegram channel"');
  });

  it("localizes social link labels for Amharic", async () => {
    const html = await renderFooter("am");
    expect(html).toContain("የፌስቡክ ገጻችንን ይከተሉ");
    expect(html).toContain("የቴሌግራም ቻናላችንን ይቀላቀሉ");
  });

  it("localizes social link labels for Afaan Oromo", async () => {
    const html = await renderFooter("om");
    expect(html).toContain("Fuula Facebook keenyaa hordofi");
    expect(html).toContain("Chaanaalii Telegram keenyaa hordofi");
  });
});

describe("SiteFooter contact link", () => {
  it("renders a Contact link to the contact page", async () => {
    const html = await renderFooter("en");

    expect(html).toContain('href="/contact"');
    expect(html).toContain(">Contact</a>");
  });

  it("localizes the Contact label", async () => {
    expect(await renderFooter("am")).toContain("ያግኙን");
    expect(await renderFooter("om")).toContain("Nu qunnamaa");
  });
});

describe("SiteFooter public information links", () => {
  it("links to About, FAQ, and all legal pages in English", async () => {
    const html = await renderFooter("en");

    for (const path of ["/about", "/faq", "/privacy", "/terms", "/cookies"]) {
      expect(html).toContain(`href="${path}"`);
    }
    for (const label of [
      "About",
      "FAQ",
      "Privacy Policy",
      "Terms of Use",
      "Cookie Policy",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("preserves the active locale in public information links", async () => {
    const html = await renderFooter("am");

    for (const path of ["/am/about", "/am/faq", "/am/privacy", "/am/terms", "/am/cookies"]) {
      expect(html).toContain(`href="${path}"`);
    }
  });
});
