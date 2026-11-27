import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries } from "@/lib/i18n/dictionary";

const mocks = vi.hoisted(() => ({
  mockGetI18n: vi.fn(),
}));

vi.mock("@/lib/i18n/server", () => ({
  getI18n: () => mocks.mockGetI18n(),
}));

import ContactPage from "@/app/contact/page";

async function renderContact(locale: "en" | "am" | "om" = "en") {
  mocks.mockGetI18n.mockResolvedValue(dictionaries[locale]);
  const element = await ContactPage();
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ContactPage", () => {
  it("shows the contact email with a mailto link", async () => {
    const html = await renderContact("en");

    expect(html).toContain("jobethiopiaet@gmail.com");
    expect(html).toContain('href="mailto:jobethiopiaet@gmail.com"');
    expect(html).toContain("Contact us");
    expect(html).toContain("Email jobethiopiaet@gmail.com");
  });

  it("localizes the heading and copy for Amharic", async () => {
    const html = await renderContact("am");

    expect(html).toContain(dictionaries.am.contact.heading);
    expect(html).toContain('href="mailto:jobethiopiaet@gmail.com"');
  });

  it("localizes the heading and copy for Afaan Oromo", async () => {
    const html = await renderContact("om");

    expect(html).toContain(dictionaries.om.contact.heading);
    expect(html).toContain('href="mailto:jobethiopiaet@gmail.com"');
  });
});
