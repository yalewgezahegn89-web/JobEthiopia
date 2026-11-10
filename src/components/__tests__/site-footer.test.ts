import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries } from "@/lib/i18n/dictionary";

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
  return renderToStaticMarkup(element);
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
