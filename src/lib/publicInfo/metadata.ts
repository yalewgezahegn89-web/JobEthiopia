import type { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { LOCALE_METADATA } from "@/lib/i18n/locale";
import { getCurrentLocale } from "@/lib/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getPublicInformationContent } from "./content";

export type PublicInformationPageKey = "about" | "faq";

const PAGE_PATHS: Record<PublicInformationPageKey, string> = {
  about: "/about",
  faq: "/faq",
};

export function publicInformationPagePath(
  key: PublicInformationPageKey,
): string {
  return PAGE_PATHS[key];
}

export async function buildPublicInformationMetadata(
  key: PublicInformationPageKey,
): Promise<Metadata> {
  const locale = await getCurrentLocale();
  const document = getPublicInformationContent(locale)[key];

  return buildPageMetadata({
    path: publicInformationPagePath(key),
    locale,
    baseUrl: getAppBaseUrl(),
    title: document.metaTitle,
    description: document.metaDescription,
    absoluteTitle: true,
    includeAlternates: true,
    includeXDefault: true,
    openGraphLocale: LOCALE_METADATA[locale].intl,
  });
}
